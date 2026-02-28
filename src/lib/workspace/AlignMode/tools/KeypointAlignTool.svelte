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

	const MAX_PAIRS = 4;

	type Pt = { x: number; y: number }; // normalised 0..1
	type Pair = { target: Pt; source: Pt };

	let targetImg: HTMLImageElement | null = null;
	let sourceImg: HTMLImageElement | null = null;
	let targetWrap: HTMLDivElement | null = null;
	let sourceWrap: HTMLDivElement | null = null;

	let previewCanvas: HTMLCanvasElement | null = null;

	let cvReady = false;
	let cvError: string | null = null;

	let pairs: Pair[] = [];
	let overlayOpacity = 60;

	// “Which pair am I currently adjusting on the source image?”
	let adjustIndex: number | null = null;

	let computed: {
		transform: ImageAlignment['transform'];
		confidence: number;
		methodData?: any;
	} | null = null;

	let toast: string | null = null;
	let toastTimer: any = null;

	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 1800);
	}

	function clamp01(v: number) {
		return Math.max(0, Math.min(1, v));
	}

	function pointFromEvent(e: MouseEvent | PointerEvent, wrap: HTMLDivElement): Pt {
		const r = wrap.getBoundingClientRect();
		const x = clamp01((e.clientX - r.left) / r.width);
		const y = clamp01((e.clientY - r.top) / r.height);
		return { x, y };
	}

	/* -------------------------------------------------
	   Quad ordering helpers (prevents “bow-tie” 4-point warp)
	------------------------------------------------- */

	function toPx(pt: Pt, img: HTMLImageElement) {
		return {
			x: pt.x * img.naturalWidth,
			y: pt.y * img.naturalHeight
		};
	}

	function argMin(vals: number[]) {
		let best = 0;
		for (let i = 1; i < vals.length; i++) if (vals[i] < vals[best]) best = i;
		return best;
	}

	function argMax(vals: number[]) {
		let best = 0;
		for (let i = 1; i < vals.length; i++) if (vals[i] > vals[best]) best = i;
		return best;
	}

	/**
	 * Return indices in TL, TR, BR, BL order based on TARGET points.
	 * (Works well for typical page/corner selections.)
	 */
	function orderQuadByTarget(targetPtsPx: { x: number; y: number }[]) {
		const sums = targetPtsPx.map((p) => p.x + p.y);
		const diffs = targetPtsPx.map((p) => p.x - p.y);

		const tl = argMin(sums);
		const br = argMax(sums);
		const tr = argMax(diffs);
		const bl = argMin(diffs);

		const order = [tl, tr, br, bl];

		// Guard: if the heuristic produces duplicates (rare), fall back to original order
		if (new Set(order).size !== 4) return [0, 1, 2, 3];

		return order;
	}

	/* -------------------------------------------------
	   Add points:
	   Click TARGET adds a pair immediately, with SOURCE initialised to same coords
	   Then user adjusts SOURCE (drag or click in source)
	------------------------------------------------- */

	function onTargetClick(e: MouseEvent) {
		if (!targetWrap) return;

		if (pairs.length >= MAX_PAIRS) {
			showToast(`Max ${MAX_PAIRS} point pairs`);
			return;
		}

		const pt = pointFromEvent(e, targetWrap);

		// Add a complete pair immediately (source starts at same normalised position)
		pairs = [...pairs, { target: pt, source: { ...pt } }];
		adjustIndex = pairs.length - 1; // now adjust this one on the source image
		computed = null;
	}

	function onSourceClick(e: MouseEvent) {
		if (!sourceWrap) return;
		if (adjustIndex == null) return;

		const pt = pointFromEvent(e, sourceWrap);

		// Clicking the source image repositions the “active” source point
		const next = [...pairs];
		next[adjustIndex] = { ...next[adjustIndex], source: pt };
		pairs = next;
		computed = null;
	}

	function undoLast() {
		if (pairs.length === 0) return;

		pairs = pairs.slice(0, -1);
		adjustIndex = pairs.length ? pairs.length - 1 : null;
		computed = null;
	}

	function resetAll() {
		pairs = [];
		adjustIndex = null;
		computed = null;
	}

	function removePair(idx: number) {
		pairs = pairs.filter((_, i) => i !== idx);
		if (pairs.length === 0) {
			adjustIndex = null;
		} else if (adjustIndex != null) {
			adjustIndex = Math.min(adjustIndex, pairs.length - 1);
		}
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

		// If user drags a source marker, make that pair the active adjust target
		if (side === 'source') adjustIndex = index;

		const pt = pointFromEvent(e, wrap);
		updatePoint(side, index, pt);
	}

	function moveDrag(e: PointerEvent, wrap: HTMLDivElement) {
		if (!drag) return;
		const pt = pointFromEvent(e, wrap);
		updatePoint(drag.side, drag.index, pt);
	}

	function endDrag() {
		if (!drag) return;
		drag = null;
		computed = null;
	}

	function updatePoint(side: 'target' | 'source', index: number, pt: Pt) {
		const p = pairs[index];
		if (!p) return;

		const next = [...pairs];
		next[index] = side === 'target' ? { ...p, target: pt } : { ...p, source: pt };
		pairs = next;
	}

	/* -------------------------------------------------
	   OpenCV loader (opencv.js)
	------------------------------------------------- */

	function ensureOpenCV(): Promise<void> {
		if (typeof window === 'undefined') return Promise.reject('No window');
		const w = window as any;

		if (w.cv && w.cv.Mat) return Promise.resolve();

		return new Promise((resolve, reject) => {
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
	   OpenCV image read at natural size (IMPORTANT)
	   cv.imread(imgEl) reads rendered size; we need natural pixels.
	------------------------------------------------- */

	function imreadNatural(img: HTMLImageElement, cv: any) {
		const c = document.createElement('canvas');
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;

		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D context unavailable');

		ctx.drawImage(img, 0, 0, c.width, c.height);
		return cv.imread(c);
	}

	/* -------------------------------------------------
	   Compute transform + preview
	   - 3 pairs => affine (converted to 3x3)
	   - 4 pairs => perspective (exact) + ordered to prevent self-crossing
	------------------------------------------------- */

	async function compute() {
		computed = null;

		if (!cvReady) {
			cvError ??= 'OpenCV not ready yet.';
			return;
		}
		if (!targetImg || !sourceImg || !previewCanvas) return;

		if (!targetImg.naturalWidth || !sourceImg.naturalWidth) {
			showToast('Images not fully loaded yet');
			return;
		}

		const n = pairs.length;
		if (n < 3) {
			showToast('Need at least 3 point pairs');
			return;
		}
		if (n > 4) {
			showToast(`Max ${MAX_PAIRS} point pairs`);
			return;
		}

		const wcv = (window as any).cv;

		let H: any = null;
		let transformType: 'affine' | 'homography' = 'homography';
		let confidence = 1;

		// point mats (filled differently per mode)
		let srcPts: any = null;
		let dstPts: any = null;

		try {
			if (n === 3) {
				transformType = 'affine';

				// 3-point affine requires 3 points in src/dst, order matters but not crossing
				const srcFlat: number[] = [];
				const dstFlat: number[] = [];

				for (const p of pairs) {
					const s = toPx(p.source, sourceImg);
					const t = toPx(p.target, targetImg);
					srcFlat.push(s.x, s.y);
					dstFlat.push(t.x, t.y);
				}

				srcPts = wcv.matFromArray(3, 1, wcv.CV_32FC2, srcFlat);
				dstPts = wcv.matFromArray(3, 1, wcv.CV_32FC2, dstFlat);

				const A = wcv.getAffineTransform(srcPts, dstPts); // 2x3
				const a = A.data64F && A.data64F.length ? Array.from(A.data64F) : Array.from(A.data32F);

				const m3 = [a[0], a[1], a[2], a[3], a[4], a[5], 0, 0, 1];
				H = wcv.matFromArray(3, 3, wcv.CV_64F, m3);

				A.delete();
			} else {
				// n === 4
				transformType = 'homography';

				// Reorder the 4 correspondences into TL, TR, BR, BL (based on TARGET)
				const targetPx = pairs.map((p) => toPx(p.target, targetImg));
				const order = orderQuadByTarget(targetPx);

				const srcFlat: number[] = [];
				const dstFlat: number[] = [];

				for (const i of order) {
					const s = toPx(pairs[i].source, sourceImg);
					const t = toPx(pairs[i].target, targetImg);
					srcFlat.push(s.x, s.y);
					dstFlat.push(t.x, t.y);
				}

				srcPts = wcv.matFromArray(4, 1, wcv.CV_32FC2, srcFlat);
				dstPts = wcv.matFromArray(4, 1, wcv.CV_32FC2, dstFlat);

				H = wcv.getPerspectiveTransform(srcPts, dstPts); // 3x3
			}

			// Preview output canvas should be target natural size
			previewCanvas.width = targetImg.naturalWidth;
			previewCanvas.height = targetImg.naturalHeight;

			// Warp preview: warp source -> target canvas size
			const srcMat = imreadNatural(sourceImg, wcv);
			const dstMat = new wcv.Mat();
			const dsize = new wcv.Size(targetImg.naturalWidth, targetImg.naturalHeight);

			wcv.warpPerspective(srcMat, dstMat, H, dsize);
			wcv.imshow(previewCanvas, dstMat);

			const data = H.data64F && H.data64F.length ? Array.from(H.data64F) : Array.from(H.data32F);

			computed = {
				confidence,
				transform: {
					type: transformType,
					matrix: data
				},
				methodData: {
					pointCount: n,
					pairs
				}
			};

			srcMat.delete();
			dstMat.delete();
		} catch (err) {
			console.error(err);
			cvError = 'Alignment failed (see console).';
		} finally {
			if (srcPts) srcPts.delete();
			if (dstPts) dstPts.delete();
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

	/* -------------------------------------------------
	   Export helpers
	   - Export warped: the warped source (target pixel space)
	   - Export composite: target + warped overlay
	------------------------------------------------- */

	async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
		const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
		if (!blob) return;

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function exportWarped() {
		if (!previewCanvas || !computed) return;
		await downloadCanvas(previewCanvas, 'aligned-warped.png');
	}

	async function exportComposite() {
		if (!previewCanvas || !targetImg || !computed) return;

		const out = document.createElement('canvas');
		out.width = previewCanvas.width;
		out.height = previewCanvas.height;

		const ctx = out.getContext('2d');
		if (!ctx) return;

		ctx.drawImage(targetImg, 0, 0, out.width, out.height);
		ctx.globalAlpha = 1;
		ctx.drawImage(previewCanvas, 0, 0, out.width, out.height);

		await downloadCanvas(out, 'aligned-composite.png');
	}
</script>

<div class="tool">
	<div class="tool-header">
		<div class="left">
			<div class="name">Keypoints alignment</div>
			<div class="hint">
				Click the <b>target</b> to add a pair (max {MAX_PAIRS}). Then adjust the matching point on
				the
				<b>source</b> (by drag or click).
			</div>
		</div>

		<div class="right">
			<span class="chip">{pairs.length}/{MAX_PAIRS} pairs</span>

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
				disabled={!cvReady || pairs.length < 3}
			>
				Compute
			</button>

			<button class="btn" type="button" on:click={exportWarped} disabled={!computed}>
				Export warped
			</button>

			<button class="btn" type="button" on:click={exportComposite} disabled={!computed}>
				Export composite
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
					<div
						class="marker"
						class:active={i === adjustIndex}
						style="left: {p.target.x * 100}%; top: {p.target.y * 100}%"
						on:pointerdown={(e) => targetWrap && startDrag(e, 'target', i, targetWrap)}
						on:pointerup={endDrag}
						on:pointercancel={endDrag}
					>
						{i + 1}
					</div>
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
					<div
						class="marker"
						class:active={i === adjustIndex}
						style="left: {p.source.x * 100}%; top: {p.source.y * 100}%"
						on:pointerdown={(e) => sourceWrap && startDrag(e, 'source', i, sourceWrap)}
						on:pointerup={endDrag}
						on:pointercancel={endDrag}
					>
						{i + 1}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="pairs">
		<div class="pairs-title">Point pairs</div>

		{#if pairs.length === 0}
			<div class="pairs-empty">Click the target image to add point #1.</div>
		{:else}
			{#each pairs as p, i (i)}
				<div class="pair-row" class:active={i === adjustIndex} on:click={() => (adjustIndex = i)}>
					<div class="pair-idx">{i + 1}</div>
					<div class="pair-coords">
						<div>
							T: <span class="mono">{p.target.x.toFixed(3)}, {p.target.y.toFixed(3)}</span>
						</div>
						<div>
							S: <span class="mono">{p.source.x.toFixed(3)}, {p.source.y.toFixed(3)}</span>
						</div>
					</div>
					<button class="remove" type="button" on:click|stopPropagation={() => removePair(i)}>
						Remove
					</button>
				</div>
			{/each}
		{/if}
	</div>

	{#if toast}
		<div class="toast">{toast}</div>
	{/if}

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
		align-items: flex-start;
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
		margin-top: 0.2rem;
		max-width: 60ch;
	}

	.right {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		align-items: center;
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

	.toast {
		position: sticky;
		top: 0;
		z-index: 20;
		background: rgba(17, 24, 39, 0.92);
		color: white;
		padding: 0.45rem 0.6rem;
		border-radius: 10px;
		font-size: 0.85rem;
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

	.marker.active {
		outline: 2px solid rgba(2, 132, 199, 0.8);
		outline-offset: 2px;
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
		cursor: pointer;
	}

	.pair-row:first-of-type {
		border-top: none;
	}

	.pair-row.active {
		background: rgba(2, 132, 199, 0.06);
		border-radius: 10px;
		padding-left: 0.4rem;
		padding-right: 0.4rem;
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
