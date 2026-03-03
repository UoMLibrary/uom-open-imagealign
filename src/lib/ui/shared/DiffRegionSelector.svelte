<!-- DiffRegionSuggestor.svelte -->
<script context="module" lang="ts">
	export type Region = {
		id: string;
		/** normalised 0..1 */
		x: number;
		y: number;
		w: number;
		h: number;
		/** pixel area in processing space (useful for sorting/debug) */
		area: number;
	};
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';

	export let diffSrc: string;

	/**
	 * 0..1 (left = more sensitive/more boxes, right = stricter/fewer boxes)
	 */
	export let accuracy = 0.65;

	/**
	 * Max dimension (px) to process at. Large diffs can be downscaled for speed.
	 * The returned regions are still normalised, so they remain correct.
	 */
	export let maxProcessDim = 1200;

	/** Limit the number of regions returned after filtering/merging */
	export let maxRegions = 40;

	/** Callback prop (Svelte 5 friendly) */
	export let onRegionsChange: ((regions: Region[]) => void) | undefined;

	let regions: Region[] = [];
	let activeId: string | null = null;

	let imgEl: HTMLImageElement | null = null;

	let loading = false;
	let error: string | null = null;

	let debounceTimer: number | null = null;

	function uid() {
		return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
	}

	function clamp01(v: number) {
		return Math.max(0, Math.min(1, v));
	}

	function lerp(a: number, b: number, t: number) {
		return a + (b - a) * t;
	}

	function scheduleRecompute() {
		if (!diffSrc) return;

		if (debounceTimer) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			debounceTimer = null;
			void computeRegions();
		}, 90);
	}

	onDestroy(() => {
		if (debounceTimer) window.clearTimeout(debounceTimer);
	});

	$: scheduleRecompute();

	async function loadImage(src: string) {
		const img = new Image();
		// If your diff image is served with CORS headers, this allows canvas access.
		// If it's local/same-origin, it's fine either way.
		img.crossOrigin = 'anonymous';
		img.decoding = 'async';
		img.src = src;
		await img.decode();
		return img;
	}

	type Box = { x0: number; y0: number; x1: number; y1: number; area: number };

	function boxesTouchOrClose(a: Box, b: Box, gap: number) {
		// Expand both boxes by `gap` and test intersection
		return !(a.x1 + gap < b.x0 || a.x0 - gap > b.x1 || a.y1 + gap < b.y0 || a.y0 - gap > b.y1);
	}

	function mergeBoxes(boxes: Box[], gap: number) {
		const merged: Box[] = [];

		for (const box of boxes) {
			let mergedInto = false;

			for (const m of merged) {
				if (boxesTouchOrClose(m, box, gap)) {
					m.x0 = Math.min(m.x0, box.x0);
					m.y0 = Math.min(m.y0, box.y0);
					m.x1 = Math.max(m.x1, box.x1);
					m.y1 = Math.max(m.y1, box.y1);
					m.area += box.area;
					mergedInto = true;
					break;
				}
			}

			if (!mergedInto) merged.push({ ...box });
		}

		return merged;
	}

	function unionFindBoxes(mask: Uint8Array, w: number, h: number, minArea: number): Box[] {
		const n = w * h;

		const parent = new Int32Array(n);
		const size = new Int32Array(n);

		for (let i = 0; i < n; i++) {
			parent[i] = -1;
			size[i] = 0;
		}

		// init only where mask==1
		for (let i = 0; i < n; i++) {
			if (mask[i]) {
				parent[i] = i;
				size[i] = 1;
			}
		}

		function find(i: number) {
			while (parent[i] !== i) {
				parent[i] = parent[parent[i]];
				i = parent[i];
			}
			return i;
		}

		function union(a: number, b: number) {
			let ra = find(a);
			let rb = find(b);
			if (ra === rb) return;

			if (size[ra] < size[rb]) {
				const t = ra;
				ra = rb;
				rb = t;
			}

			parent[rb] = ra;
			size[ra] += size[rb];
		}

		// single pass unions (left + up)
		for (let y = 0; y < h; y++) {
			const row = y * w;
			for (let x = 0; x < w; x++) {
				const i = row + x;
				if (!mask[i]) continue;

				if (x > 0 && mask[i - 1]) union(i, i - 1);
				if (y > 0 && mask[i - w]) union(i, i - w);
			}
		}

		// accumulate bboxes using a Map keyed by root
		const acc = new Map<number, Box>();

		for (let y = 0; y < h; y++) {
			const row = y * w;
			for (let x = 0; x < w; x++) {
				const i = row + x;
				if (!mask[i]) continue;

				const r = find(i);
				let b = acc.get(r);
				if (!b) {
					b = { x0: x, y0: y, x1: x + 1, y1: y + 1, area: 0 };
					acc.set(r, b);
				}

				if (x < b.x0) b.x0 = x;
				if (y < b.y0) b.y0 = y;
				if (x + 1 > b.x1) b.x1 = x + 1;
				if (y + 1 > b.y1) b.y1 = y + 1;
				b.area++;
			}
		}

		const out: Box[] = [];
		for (const b of acc.values()) {
			if (b.area >= minArea) out.push(b);
		}

		out.sort((a, b) => b.area - a.area);
		return out;
	}

	async function computeRegions() {
		if (!diffSrc) return;

		loading = true;
		error = null;

		try {
			// Load once per src change (cheap decode, then we process from pixels)
			if (!imgEl || imgEl.src !== diffSrc) {
				imgEl = await loadImage(diffSrc);
			}

			const srcW = imgEl.naturalWidth || imgEl.width;
			const srcH = imgEl.naturalHeight || imgEl.height;

			if (!srcW || !srcH) {
				throw new Error('Image has no size (naturalWidth/naturalHeight are 0).');
			}

			// Downscale for processing if needed
			const maxDim = Math.max(srcW, srcH);
			const scale = maxDim > maxProcessDim ? maxProcessDim / maxDim : 1;

			const w = Math.max(1, Math.round(srcW * scale));
			const h = Math.max(1, Math.round(srcH * scale));

			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) throw new Error('Could not create 2D context');

			ctx.imageSmoothingEnabled = true;
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(imgEl, 0, 0, w, h);

			const imgData = ctx.getImageData(0, 0, w, h);
			const data = imgData.data;

			/**
			 * Accuracy mapping:
			 * - lower accuracy => lower threshold (more sensitive) + smaller minArea + larger merge gap
			 * - higher accuracy => higher threshold (stricter) + larger minArea + smaller merge gap
			 */
			const t = clamp01(accuracy);

			// Strength threshold (0..255)
			const thr = Math.round(lerp(24, 140, t));

			// Minimum component area (in processing pixels)
			const totalPx = w * h;
			const minArea = Math.round(lerp(totalPx * 0.00002, totalPx * 0.00035, t)); // e.g. ~20..350 for 1MP

			// How close boxes need to be to merge (in processing pixels)
			const mergeGap = Math.round(lerp(18, 4, t));

			// Optional padding (tightens with higher accuracy)
			const pad = Math.round(lerp(10, 2, t));

			// Build mask: "difference strength" = max RGB channel (works for white or coloured diffs)
			const mask = new Uint8Array(totalPx);

			for (let i = 0, p = 0; p < totalPx; p++, i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];
				const a = data[i + 3];

				// Ignore fully transparent
				if (a === 0) continue;

				const strength = r > g ? (r > b ? r : b) : g > b ? g : b;
				if (strength >= thr) mask[p] = 1;
			}

			let boxes = unionFindBoxes(mask, w, h, Math.max(1, minArea));

			// Merge nearby boxes (usually reduces noise a lot)
			boxes = mergeBoxes(boxes, mergeGap);

			// Pad and clamp
			for (const b of boxes) {
				b.x0 = Math.max(0, b.x0 - pad);
				b.y0 = Math.max(0, b.y0 - pad);
				b.x1 = Math.min(w, b.x1 + pad);
				b.y1 = Math.min(h, b.y1 + pad);
			}

			// Sort again (post-merge), then cap
			boxes.sort((a, b) => b.area - a.area);
			boxes = boxes.slice(0, Math.max(1, maxRegions));

			const next: Region[] = boxes.map((b) => ({
				id: uid(),
				x: b.x0 / w,
				y: b.y0 / h,
				w: (b.x1 - b.x0) / w,
				h: (b.y1 - b.y0) / h,
				area: b.area
			}));

			regions = next;
			activeId = regions[0]?.id ?? null;
			onRegionsChange?.(regions);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			regions = [];
			activeId = null;
			onRegionsChange?.(regions);
		} finally {
			loading = false;
		}
	}

	function selectRegion(id: string) {
		activeId = id;
	}

	function removeRegion(id: string) {
		regions = regions.filter((r) => r.id !== id);
		if (activeId === id) activeId = regions[0]?.id ?? null;
		onRegionsChange?.(regions);
	}

	function clearAll() {
		regions = [];
		activeId = null;
		onRegionsChange?.(regions);
	}
</script>

<div class="shell">
	<div class="controls">
		<div class="row">
			<label class="label">
				Accuracy
				<span class="hint">({Math.round(accuracy * 100)}%)</span>
			</label>

			<input
				class="slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={accuracy}
				aria-label="Accuracy"
			/>
		</div>

		<div class="meta">
			{#if loading}
				<span class="status">Analysing…</span>
			{:else if error}
				<span class="status error">Error: {error}</span>
			{:else}
				<span class="status">{regions.length} region(s)</span>
			{/if}

			<div class="actions">
				<button type="button" class="btn" on:click={() => void computeRegions()} disabled={loading}>
					Recompute
				</button>
				<button
					type="button"
					class="btn subtle"
					on:click={clearAll}
					disabled={loading || regions.length === 0}
				>
					Clear
				</button>
			</div>
		</div>
	</div>

	<div class="viewer">
		<div class="image-wrap">
			<img class="img" src={diffSrc} alt="Difference image" />

			<!-- overlay regions -->
			{#each regions as r (r.id)}
				<button
					type="button"
					class="box {r.id === activeId ? 'active' : ''}"
					style="
						left: {r.x * 100}%;
						top: {r.y * 100}%;
						width: {r.w * 100}%;
						height: {r.h * 100}%;
					"
					on:click={() => selectRegion(r.id)}
					aria-label="Region"
				>
					<span class="tag">
						{regions.findIndex((x) => x.id === r.id) + 1}
					</span>
				</button>
			{/each}
		</div>

		<div class="list">
			<div class="list-header">
				<div class="title">Suggested regions</div>
				<div class="sub">Click a box to focus. Remove any noise.</div>
			</div>

			{#if regions.length === 0}
				<div class="empty">No regions yet. Lower Accuracy to be more sensitive.</div>
			{:else}
				<ul>
					{#each regions as r, i (r.id)}
						<li class={r.id === activeId ? 'active' : ''}>
							<button type="button" class="rowbtn" on:click={() => selectRegion(r.id)}>
								<span class="idx">{i + 1}</span>
								<span class="coords">
									x:{r.x.toFixed(3)} y:{r.y.toFixed(3)} w:{r.w.toFixed(3)} h:{r.h.toFixed(3)}
								</span>
							</button>
							<button
								type="button"
								class="del"
								on:click={() => removeRegion(r.id)}
								aria-label="Remove"
							>
								×
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.shell {
		display: grid;
		gap: 0.75rem;
	}

	.controls {
		padding: 0.75rem;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.9);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.label {
		font-size: 0.85rem;
		font-weight: 650;
		color: #111827;
		white-space: nowrap;
	}

	.hint {
		font-weight: 550;
		color: #6b7280;
		margin-left: 0.35rem;
	}

	.slider {
		width: 100%;
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.6rem;
	}

	.status {
		font-size: 0.85rem;
		color: #374151;
	}

	.status.error {
		color: #b91c1c;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		font-size: 0.85rem;
		padding: 0.35rem 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: #111827;
		color: white;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.btn.subtle {
		background: white;
		color: #111827;
	}

	.viewer {
		display: grid;
		grid-template-columns: 1fr 360px;
		gap: 0.75rem;
		align-items: start;
	}

	.image-wrap {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: #0b0f19;
	}

	.img {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
	}

	.box {
		position: absolute;
		border: 2px solid rgba(59, 130, 246, 0.9);
		background: rgba(59, 130, 246, 0.08);
		border-radius: 10px;
		cursor: pointer;
		padding: 0;
		display: block;
	}

	.box.active {
		border-color: rgba(245, 158, 11, 0.95);
		background: rgba(245, 158, 11, 0.12);
	}

	.tag {
		position: absolute;
		top: -10px;
		left: -10px;
		width: 22px;
		height: 22px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-size: 0.72rem;
		font-weight: 800;
		color: white;
		background: rgba(17, 24, 39, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.18);
	}

	.list {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.9);
		overflow: hidden;
	}

	.list-header {
		padding: 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.title {
		font-size: 0.85rem;
		font-weight: 800;
		color: #111827;
	}

	.sub {
		font-size: 0.8rem;
		color: #6b7280;
		margin-top: 0.2rem;
	}

	.empty {
		padding: 0.9rem;
		font-size: 0.85rem;
		color: #6b7280;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0.25rem;
		display: grid;
		gap: 0.25rem;
	}

	li {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.25rem;
		border-radius: 10px;
	}

	li.active {
		background: rgba(245, 158, 11, 0.12);
	}

	.rowbtn {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		width: 100%;
		text-align: left;
		padding: 0.45rem 0.6rem;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.idx {
		width: 1.5rem;
		font-weight: 800;
		color: #111827;
	}

	.coords {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.78rem;
		color: #374151;
	}

	.del {
		width: 34px;
		height: 34px;
		margin-right: 0.3rem;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: white;
		cursor: pointer;
		font-size: 1.15rem;
		line-height: 1;
		color: #111827;
	}

	@media (max-width: 980px) {
		.viewer {
			grid-template-columns: 1fr;
		}
	}
</style>
