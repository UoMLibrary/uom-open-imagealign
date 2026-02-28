<script lang="ts">
	import { onMount } from 'svelte';
	import type { ImageAlignment } from '$lib/core/types';

	export type AlignmentDraft = {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	};

	export let targetUrl: string; // base image
	export let sourceUrl: string; // image to align onto target
	export let existingAlignment: ImageAlignment | null = null;

	// Svelte 5 callback prop
	export let onSave: (draft: AlignmentDraft) => void;

	// If you prefer a local copy, pass a local URL in from the workspace
	export let opencvSrc = 'https://docs.opencv.org/4.x/opencv.js';

	type Pt = { x: number; y: number }; // normalised 0..1
	type Pair = { target?: Pt; source?: Pt };

	let targetImg: HTMLImageElement | null = null;
	let sourceImg: HTMLImageElement | null = null;
	let targetWrap: HTMLDivElement | null = null;
	let sourceWrap: HTMLDivElement | null = null;

	let previewCanvas: HTMLCanvasElement | null = null;

	let cvReady = false;
	let cvError: string | null = null;

	let pairs: Pair[] = [];
	let next: 'target' | 'source' = 'target';
	let overlayOpacity = 60;

	let computed: {
		transform: ImageAlignment['transform'];
		confidence: number;
		methodData?: any;
	} | null = null;

	function clamp01(v: number) {
		return Math.max(0, Math.min(1, v));
	}

	function pointFromClick(e: MouseEvent, wrap: HTMLDivElement): Pt {
		const r = wrap.getBoundingClientRect();
		const x = clamp01((e.clientX - r.left) / r.width);
		const y = clamp01((e.clientY - r.top) / r.height);
		return { x, y };
	}

	function addOrUpdateTargetPoint(pt: Pt) {
		// If last pair is incomplete and needs target, fill it; else push new.
		const last = pairs[pairs.length - 1];
		if (last && !last.target && !last.source) {
			last.target = pt;
			pairs = [...pairs];
		} else if (last && last.target && !last.source) {
			// user clicked target again while waiting for source: replace target
			last.target = pt;
			pairs = [...pairs];
		} else {
			pairs = [...pairs, { target: pt }];
		}
		next = 'source';
		computed = null;
	}

	function addOrUpdateSourcePoint(pt: Pt) {
		const last = pairs[pairs.length - 1];
		if (!last || !last.target) {
			// Don’t allow source-first; keeps correspondence clean
			return;
		}
		last.source = pt;
		pairs = [...pairs];
		next = 'target';
		computed = null;
	}

	function onTargetClick(e: MouseEvent) {
		if (!targetWrap) return;
		if (next !== 'target') {
			// If waiting for source, allow retargeting the last target point
			const pt = pointFromClick(e, targetWrap);
			addOrUpdateTargetPoint(pt);
			return;
		}
		const pt = pointFromClick(e, targetWrap);
		addOrUpdateTargetPoint(pt);
	}

	function onSourceClick(e: MouseEvent) {
		if (!sourceWrap) return;
		if (next !== 'source') return;
		const pt = pointFromClick(e, sourceWrap);
		addOrUpdateSourcePoint(pt);
	}

	function undoLast() {
		if (pairs.length === 0) return;

		const last = pairs[pairs.length - 1];
		if (last && last.target && !last.source) {
			// remove incomplete pair
			pairs = pairs.slice(0, -1);
			next = 'target';
		} else {
			pairs = pairs.slice(0, -1);
			next = 'target';
		}
		computed = null;
	}

	function resetAll() {
		pairs = [];
		next = 'target';
		computed = null;
	}

	function removePair(idx: number) {
		pairs = pairs.filter((_, i) => i !== idx);
		// recompute next step based on last pair completeness
		const last = pairs[pairs.length - 1];
		next = last && last.target && !last.source ? 'source' : 'target';
		computed = null;
	}

	/* -------------------------------------------------
	   Dragging points (updates normalised coords)
	------------------------------------------------- */

	type DragState = {
		side: 'target' | 'source';
		index: number;
		pointerId: number;
	};

	let drag: DragState | null = null;

	function startDrag(
		e: PointerEvent,
		side: 'target' | 'source',
		index: number,
		wrap: HTMLDivElement
	) {
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { side, index, pointerId: e.pointerId };

		const r = wrap.getBoundingClientRect();
		const x = clamp01((e.clientX - r.left) / r.width);
		const y = clamp01((e.clientY - r.top) / r.height);

		updatePoint(side, index, { x, y });
	}

	function moveDrag(e: PointerEvent, wrap: HTMLDivElement) {
		if (!drag) return;

		const r = wrap.getBoundingClientRect();
		const x = clamp01((e.clientX - r.left) / r.width);
		const y = clamp01((e.clientY - r.top) / r.height);

		updatePoint(drag.side, drag.index, { x, y });
	}

	function endDrag(e: PointerEvent) {
		if (!drag) return;
		drag = null;
		computed = null;
	}

	function updatePoint(side: 'target' | 'source', index: number, pt: Pt) {
		const p = pairs[index];
		if (!p) return;

		const nextPairs = [...pairs];
		nextPairs[index] = {
			...p,
			[side]: pt
		};
		pairs = nextPairs;
	}

	/* -------------------------------------------------
	   OpenCV loader (opencv.js)
	------------------------------------------------- */

	function ensureOpenCV(): Promise<void> {
		if (typeof window === 'undefined') return Promise.reject('No window');
		const w = window as any;

		// Already loaded and initialised
		if (w.cv && w.cv.Mat) return Promise.resolve();

		return new Promise((resolve, reject) => {
			// If script already present, just wait for init
			const existing = document.querySelector(
				'script[data-opencv="true"]'
			) as HTMLScriptElement | null;

			function waitForReady(timeoutMs = 12000) {
				const start = Date.now();
				const timer = setInterval(() => {
					if (w.cv && w.cv.Mat) {
						clearInterval(timer);
						resolve();
					} else if (Date.now() - start > timeoutMs) {
						clearInterval(timer);
						reject(new Error('OpenCV load timeout'));
					}
				}, 50);
			}

			if (existing) {
				waitForReady();
				return;
			}

			const script = document.createElement('script');
			script.src = opencvSrc;
			script.async = true;
			script.dataset.opencv = 'true';

			script.onload = () => waitForReady();
			script.onerror = () => reject(new Error('Failed to load opencv.js'));

			document.head.appendChild(script);
		});
	}

	onMount(async () => {
		try {
			await ensureOpenCV();
			cvReady = true;
		} catch (e: any) {
			cvError = e?.message ?? String(e);
		}
	});

	/* -------------------------------------------------
	   Compute transform + preview
	------------------------------------------------- */

	function allComplete(ps: Pair[]) {
		return ps.length > 0 && ps.every((p) => p.target && p.source);
	}

	function toCvPoints(ps: Pair[], side: 'target' | 'source', imgEl: HTMLImageElement) {
		// Convert normalised (0..1) to natural pixel coords
		const w = imgEl.naturalWidth;
		const h = imgEl.naturalHeight;

		const out: number[] = [];
		for (const p of ps) {
			const pt = side === 'target' ? p.target! : p.source!;
			out.push(pt.x * w, pt.y * h);
		}
		return out;
	}

	async function compute() {
		computed = null;

		if (!cvReady) {
			cvError ??= 'OpenCV not ready yet.';
			return;
		}
		if (!targetImg || !sourceImg || !previewCanvas) return;
		if (!allComplete(pairs)) return;

		const n = pairs.length;
		if (n < 3) return;

		const wcv = (window as any).cv;

		// OpenCV expects:
		//  - src = source points (image to warp)
		//  - dst = target points (base image)
		const srcFlat = toCvPoints(pairs, 'source', sourceImg);
		const dstFlat = toCvPoints(pairs, 'target', targetImg);

		// Build point Mats
		const srcPts = wcv.matFromArray(n, 1, wcv.CV_32FC2, srcFlat);
		const dstPts = wcv.matFromArray(n, 1, wcv.CV_32FC2, dstFlat);

		let H: any = null;
		let transformType: 'affine' | 'homography' = 'homography';
		let confidence = 1;
		let methodData: any = { pointCount: n };

		try {
			if (n === 3) {
				// Affine from 3 pairs
				transformType = 'affine';

				const A = wcv.getAffineTransform(srcPts, dstPts); // 2x3
				// Convert 2x3 -> 3x3
				const a = A.data64F && A.data64F.length ? Array.from(A.data64F) : Array.from(A.data32F);
				const m3 = [a[0], a[1], a[2], a[3], a[4], a[5], 0, 0, 1];
				H = wcv.matFromArray(3, 3, wcv.CV_64F, m3);

				A.delete();
				methodData.transformFrom = 'affine(3 points)';
			} else if (n === 4) {
				// Exact perspective for 4 pairs (usually more stable than findHomography for exactly 4)
				transformType = 'homography';
				H = wcv.getPerspectiveTransform(srcPts, dstPts); // 3x3
				methodData.transformFrom = 'perspective(4 points)';
			} else {
				// Robust for 5+ pairs
				transformType = 'homography';

				const mask = new wcv.Mat();
				// ransacReprojThreshold=3 pixels (tweakable later)
				H = wcv.findHomography(srcPts, dstPts, wcv.RANSAC, 3, mask);

				// Inlier ratio as a confidence proxy
				let inliers = 0;
				if (mask.rows > 0) {
					for (let i = 0; i < mask.data.length; i++) {
						if (mask.data[i]) inliers++;
					}
				}
				confidence = n > 0 ? inliers / n : 0;
				methodData.transformFrom = 'findHomography(RANSAC)';
				methodData.inliers = inliers;
				methodData.inlierRatio = confidence;

				mask.delete();
			}

			// Warp preview: warp source -> target canvas size
			const srcMat = wcv.imread(sourceImg);
			const dstMat = new wcv.Mat();
			const dsize = new wcv.Size(targetImg.naturalWidth, targetImg.naturalHeight);

			wcv.warpPerspective(srcMat, dstMat, H, dsize);
			wcv.imshow(previewCanvas, dstMat);

			// Extract matrix
			const data = H.data64F && H.data64F.length ? Array.from(H.data64F) : Array.from(H.data32F);

			computed = {
				confidence,
				transform: {
					type: transformType,
					matrix: data
				},
				methodData: {
					...methodData,
					// Store normalised pairs so the tool can be reconstructed later (if schema allows)
					pairs
				}
			};

			srcMat.delete();
			dstMat.delete();
		} catch (err) {
			console.error(err);
			cvError = 'Alignment failed (see console).';
		} finally {
			srcPts.delete();
			dstPts.delete();
			if (H) H.delete?.();
		}
	}

	function save() {
		if (!computed) return;
		onSave?.({
			confidence: computed.confidence,
			transform: computed.transform,
			methodData: computed.methodData
		});
	}
</script>

<div class="tool">
	<div class="tool-header">
		<div class="left">
			<div class="name">Keypoints alignment</div>
			<div class="hint">
				Next click: <span class="chip">{next}</span>
				<span class="sep">•</span>
				Pairs: <span class="chip">{pairs.length}</span>
			</div>
		</div>

		<div class="right">
			<button class="btn" type="button" on:click={undoLast} disabled={pairs.length === 0}>
				Undo
			</button>
			<button class="btn" type="button" on:click={resetAll} disabled={pairs.length === 0}>
				Reset
			</button>
			<button
				class="btn primary"
				type="button"
				on:click={compute}
				disabled={!cvReady || !allComplete(pairs) || pairs.length < 3}
			>
				Compute
			</button>
			<button class="btn save" type="button" on:click={save} disabled={!computed}>
				Save alignment
			</button>
		</div>
	</div>

	{#if cvError}
		<div class="error">
			{cvError}
			<div class="small">
				If you don’t want remote loading, pass a local <code>opencvSrc</code> prop or load opencv.js globally.
			</div>
		</div>
	{/if}

	<div class="selectors">
		<div class="img-block">
			<div class="block-title">Target (base)</div>

			<div
				class="img-wrap"
				bind:this={targetWrap}
				on:click={onTargetClick}
				on:pointermove={(e) => targetWrap && drag?.side === 'target' && moveDrag(e, targetWrap)}
			>
				<img bind:this={targetImg} src={targetUrl} alt="Target image" draggable="false" />

				{#each pairs as p, i (i)}
					{#if p.target}
						<div
							class="marker"
							style="left: {p.target.x * 100}%; top: {p.target.y * 100}%"
							on:pointerdown={(e) => targetWrap && startDrag(e, 'target', i, targetWrap)}
							on:pointerup={endDrag}
							on:pointercancel={endDrag}
						>
							{i + 1}
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<div class="img-block">
			<div class="block-title">Source (to align)</div>

			<div
				class="img-wrap"
				bind:this={sourceWrap}
				on:click={onSourceClick}
				on:pointermove={(e) => sourceWrap && drag?.side === 'source' && moveDrag(e, sourceWrap)}
			>
				<img bind:this={sourceImg} src={sourceUrl} alt="Source image" draggable="false" />

				{#each pairs as p, i (i)}
					{#if p.source}
						<div
							class="marker"
							style="left: {p.source.x * 100}%; top: {p.source.y * 100}%"
							on:pointerdown={(e) => sourceWrap && startDrag(e, 'source', i, sourceWrap)}
							on:pointerup={endDrag}
							on:pointercancel={endDrag}
						>
							{i + 1}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<div class="pairs">
		<div class="pairs-title">Point pairs</div>
		{#if pairs.length === 0}
			<div class="pairs-empty">
				Click the target image to place point #1, then click the source image.
			</div>
		{:else}
			{#each pairs as p, i (i)}
				<div class="pair-row">
					<div class="pair-idx">{i + 1}</div>
					<div class="pair-coords">
						<div>
							T:
							{#if p.target}
								<span class="mono">{p.target.x.toFixed(3)}, {p.target.y.toFixed(3)}</span>
							{:else}
								<span class="muted">—</span>
							{/if}
						</div>
						<div>
							S:
							{#if p.source}
								<span class="mono">{p.source.x.toFixed(3)}, {p.source.y.toFixed(3)}</span>
							{:else}
								<span class="muted">—</span>
							{/if}
						</div>
					</div>
					<button class="remove" type="button" on:click={() => removePair(i)}>Remove</button>
				</div>
			{/each}
		{/if}
	</div>

	<div class="preview">
		<div class="preview-header">
			<div class="block-title">Preview (source warped onto target)</div>

			<label class="opacity">
				Opacity
				<input type="range" min="0" max="100" bind:value={overlayOpacity} />
			</label>

			{#if computed}
				<div class="chip">
					{computed.transform.type}
					<span class="sep">•</span>
					conf: {computed.confidence.toFixed(2)}
				</div>
			{/if}
		</div>

		<div class="preview-wrap">
			{#if targetUrl}
				<img class="base" src={targetUrl} alt="Target preview" draggable="false" />
			{/if}
			<canvas class="overlay" bind:this={previewCanvas} style="opacity: {overlayOpacity / 100}" />
		</div>

		{#if existingAlignment}
			<details class="debug">
				<summary>Existing alignment (debug)</summary>
				<pre>{JSON.stringify(existingAlignment, null, 2)}</pre>
			</details>
		{/if}
	</div>
</div>

<style>
	.tool {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.tool-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.name {
		font-weight: 700;
		color: #111827;
		font-size: 0.95rem;
	}

	.hint {
		font-size: 0.78rem;
		color: #64748b;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.2rem;
	}

	.chip {
		font-size: 0.72rem;
		color: #334155;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
	}

	.sep {
		opacity: 0.6;
		margin: 0 0.15rem;
	}

	.right {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.btn {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: white;
		color: #0f172a;
	}

	.btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn.primary {
		background: #e0f2fe;
		border-color: rgba(2, 132, 199, 0.25);
		color: #075985;
		font-weight: 700;
	}

	.btn.primary:hover {
		background: #bae6fd;
	}

	.btn.save {
		background: #d1fae5;
		color: #065f46;
		border-color: rgba(6, 95, 70, 0.25);
		font-weight: 700;
	}

	.btn.save:hover {
		background: #a7f3d0;
	}

	.error {
		border: 1px solid rgba(220, 38, 38, 0.25);
		background: rgba(254, 226, 226, 0.7);
		color: #7f1d1d;
		padding: 0.6rem 0.7rem;
		border-radius: 10px;
		font-size: 0.85rem;
	}

	.small {
		margin-top: 0.25rem;
		font-size: 0.75rem;
		opacity: 0.85;
	}

	.selectors {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.img-block {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.block-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
	}

	.img-wrap {
		position: relative;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 10px;
		overflow: hidden;
		background: #f3f4f6;
		cursor: crosshair;
		min-height: 240px;
	}

	.img-wrap img {
		width: 100%;
		height: auto;
		display: block;
		user-select: none;
	}

	.marker {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.25);
		color: #111827;
		font-size: 10px;
		font-weight: 700;
		display: grid;
		place-items: center;
		z-index: 5;
		touch-action: none;
		cursor: grab;
	}

	.marker:active {
		cursor: grabbing;
	}

	.pairs {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.6rem 0.7rem;
		background: rgba(255, 255, 255, 0.75);
	}

	.pairs-title {
		font-weight: 700;
		font-size: 0.85rem;
		color: #111827;
		margin-bottom: 0.35rem;
	}

	.pairs-empty {
		font-size: 0.8rem;
		color: #64748b;
	}

	.pair-row {
		display: grid;
		grid-template-columns: 24px 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}

	.pair-row:first-of-type {
		border-top: none;
	}

	.pair-idx {
		font-weight: 700;
		color: #334155;
		font-size: 0.8rem;
	}

	.pair-coords {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		font-size: 0.8rem;
		color: #334155;
	}

	.mono {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.muted {
		opacity: 0.6;
	}

	.remove {
		all: unset;
		cursor: pointer;
		font-size: 0.75rem;
		color: #7c2d12;
		background: rgba(251, 191, 36, 0.18);
		border: 1px solid rgba(124, 45, 18, 0.18);
		padding: 0.2rem 0.45rem;
		border-radius: 8px;
	}

	.remove:hover {
		background: rgba(251, 191, 36, 0.25);
	}

	.preview {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.6rem 0.7rem;
		background: rgba(255, 255, 255, 0.75);
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.opacity {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		color: #64748b;
	}

	.preview-wrap {
		position: relative;
		border-radius: 10px;
		overflow: hidden;
		background: #f3f4f6;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.preview-wrap .base {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
	}

	.preview-wrap .overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.debug {
		margin-top: 0.6rem;
		font-size: 0.8rem;
		color: #334155;
	}

	.debug pre {
		margin: 0.5rem 0 0;
		background: rgba(0, 0, 0, 0.04);
		padding: 0.5rem;
		border-radius: 8px;
		overflow: auto;
		max-height: 220px;
	}
</style>
