<script lang="ts">
	import { onMount } from 'svelte';
	import type { ImageAlignment } from '$lib/core/types';

	export type AlignmentDraft = {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	};

	export let targetUrl: string;
	export let sourceUrl: string;
	export let existingAlignment: ImageAlignment | null = null;

	// Svelte 5 callback prop
	export let onSave: (draft: AlignmentDraft) => void;

	export let opencvSrc = 'https://docs.opencv.org/4.x/opencv.js';

	export let maxPairs = 80;

	export let ransacReprojThreshold = 4.0;
	export let ransacMaxIters = 2000;
	export let ransacConfidence = 0.995;

	export let defaultGridRows = 4;
	export let defaultGridCols = 4;
	export let defaultGridMargin = 0.08;

	type Pt = { x: number; y: number }; // normalised 0..1
	type GridMeta = { row: number; col: number } | null;
	type Pair = { target: Pt; source: Pt; grid: GridMeta };

	let targetImg: HTMLImageElement | null = null;
	let sourceImg: HTMLImageElement | null = null;
	let targetWrap: HTMLDivElement | null = null;
	let sourceWrap: HTMLDivElement | null = null;

	let previewCanvas: HTMLCanvasElement | null = null;

	let cvReady = false;
	let cvError: string | null = null;

	let pairs: Pair[] = [];
	let overlayOpacity = 60;

	let adjustIndex: number | null = null;

	let computed: {
		transform: ImageAlignment['transform'];
		confidence: number;
		methodData?: any;
	} | null = null;

	let toast: string | null = null;
	let toastTimer: any = null;

	let gridRows = defaultGridRows;
	let gridCols = defaultGridCols;
	let gridMargin = defaultGridMargin;

	let lockToGridCells = true;
	let gridActive = false;

	let gridXs: number[] | null = null;
	let gridYs: number[] | null = null;

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

	function toPx(pt: Pt, img: HTMLImageElement) {
		return {
			x: pt.x * img.naturalWidth,
			y: pt.y * img.naturalHeight
		};
	}

	/** ✅ True if the event started from a marker (prevents wrapper click adding points). */
	function isMarkerEvent(e: Event) {
		const el = e.target as HTMLElement | null;
		return !!el?.closest?.('.kp');
	}

	/* -------------------------------------------------
	   Grid helpers
	------------------------------------------------- */

	function linspace(n: number, a: number, b: number) {
		if (n <= 1) return [0.5 * (a + b)];
		const out: number[] = [];
		for (let i = 0; i < n; i++) out.push(a + (i * (b - a)) / (n - 1));
		return out;
	}

	function cellBounds(axis: number[], idx: number) {
		const left = idx === 0 ? 0 : (axis[idx - 1] + axis[idx]) / 2;
		const right = idx === axis.length - 1 ? 1 : (axis[idx] + axis[idx + 1]) / 2;
		return { left, right };
	}

	function clampToCell(pt: Pt, meta: GridMeta) {
		if (!meta || !gridXs || !gridYs) return pt;

		const xb = cellBounds(gridXs, meta.col);
		const yb = cellBounds(gridYs, meta.row);

		return {
			x: clamp01(Math.max(xb.left, Math.min(xb.right, pt.x))),
			y: clamp01(Math.max(yb.left, Math.min(yb.right, pt.y)))
		};
	}

	function seedGrid() {
		if (gridRows < 2 || gridCols < 2) {
			showToast('Grid needs at least 2×2');
			return;
		}

		const m = clamp01(gridMargin);
		gridXs = linspace(gridCols, m, 1 - m);
		gridYs = linspace(gridRows, m, 1 - m);

		const next: Pair[] = [];
		for (let r = 0; r < gridRows; r++) {
			for (let c = 0; c < gridCols; c++) {
				if (next.length >= maxPairs) break;
				const p = { x: gridXs[c], y: gridYs[r] };
				next.push({
					target: { ...p },
					source: { ...p },
					grid: { row: r, col: c }
				});
			}
		}

		pairs = next;
		adjustIndex = pairs.length ? 0 : null;
		gridActive = true;
		computed = null;

		showToast(`Seeded ${pairs.length} grid points`);
	}

	function clearGrid() {
		gridActive = false;
		gridXs = null;
		gridYs = null;
		lockToGridCells = true;
	}

	/* -------------------------------------------------
	   Add points (manual) - TARGET ONLY
	   ✅ Wrapper click adds new points, but marker interactions don't.
	------------------------------------------------- */

	function onTargetClick(e: MouseEvent) {
		if (!targetWrap) return;

		// ✅ Don’t add points when the user clicked/dragged a marker
		if (isMarkerEvent(e)) return;
		if (drag) return;

		if (pairs.length >= maxPairs) {
			showToast(`Max ${maxPairs} point pairs`);
			return;
		}

		const pt = pointFromEvent(e, targetWrap);

		pairs = [...pairs, { target: pt, source: { ...pt }, grid: null }];
		adjustIndex = pairs.length - 1;
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
		clearGrid();
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
	   Bulk “grid-ish” transforms for SOURCE points
	------------------------------------------------- */

	function centroid(pts: Pt[]) {
		if (pts.length === 0) return { x: 0.5, y: 0.5 };
		let sx = 0,
			sy = 0;
		for (const p of pts) {
			sx += p.x;
			sy += p.y;
		}
		return { x: sx / pts.length, y: sy / pts.length };
	}

	function translateSource(dx: number, dy: number) {
		if (pairs.length === 0) return;
		const next = pairs.map((p) => {
			let s = { x: clamp01(p.source.x + dx), y: clamp01(p.source.y + dy) };
			if (lockToGridCells) s = clampToCell(s, p.grid);
			return { ...p, source: s };
		});
		pairs = next;
		computed = null;
	}

	function scaleSource(f: number) {
		if (pairs.length === 0) return;
		const c = centroid(pairs.map((p) => p.source));
		const next = pairs.map((p) => {
			let s = {
				x: clamp01(c.x + (p.source.x - c.x) * f),
				y: clamp01(c.y + (p.source.y - c.y) * f)
			};
			if (lockToGridCells) s = clampToCell(s, p.grid);
			return { ...p, source: s };
		});
		pairs = next;
		computed = null;
	}

	function rotateSource(deg: number) {
		if (pairs.length === 0) return;
		const rad = (deg * Math.PI) / 180;
		const c = centroid(pairs.map((p) => p.source));
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);

		const next = pairs.map((p) => {
			const x = p.source.x - c.x;
			const y = p.source.y - c.y;
			let s = {
				x: clamp01(c.x + x * cos - y * sin),
				y: clamp01(c.y + x * sin + y * cos)
			};
			if (lockToGridCells) s = clampToCell(s, p.grid);
			return { ...p, source: s };
		});

		pairs = next;
		computed = null;
	}

	/* -------------------------------------------------
	   Dragging points (updates normalised coords)
	   ✅ Source points are adjusted by dragging ONLY.
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

		if (side === 'source') adjustIndex = index;

		let pt = pointFromEvent(e, wrap);
		const p = pairs[index];
		if (p && lockToGridCells) pt = clampToCell(pt, p.grid);

		updatePoint(side, index, pt);
	}

	function moveDrag(e: PointerEvent, wrap: HTMLDivElement) {
		if (!drag) return;

		let pt = pointFromEvent(e, wrap);
		const p = pairs[drag.index];
		if (p && lockToGridCells) pt = clampToCell(pt, p.grid);

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
	   OpenCV loader
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
		if (n > maxPairs) {
			showToast(`Max ${maxPairs} point pairs`);
			return;
		}

		const wcv = (window as any).cv;

		let H: any = null;
		let transformType: 'affine' | 'homography' = 'homography';

		let srcPts: any = null;
		let dstPts: any = null;
		let mask: any = null;

		try {
			const srcFlat: number[] = [];
			const dstFlat: number[] = [];

			for (const p of pairs) {
				const s = toPx(p.source, sourceImg);
				const t = toPx(p.target, targetImg);
				srcFlat.push(s.x, s.y);
				dstFlat.push(t.x, t.y);
			}

			srcPts = wcv.matFromArray(n, 1, wcv.CV_32FC2, srcFlat);
			dstPts = wcv.matFromArray(n, 1, wcv.CV_32FC2, dstFlat);

			let confidence = 1;

			if (n === 3) {
				transformType = 'affine';

				if (typeof wcv.estimateAffine2D === 'function') {
					const inliers = new wcv.Mat();
					const A = wcv.estimateAffine2D(
						srcPts,
						dstPts,
						inliers,
						wcv.RANSAC,
						ransacReprojThreshold,
						ransacMaxIters,
						ransacConfidence
					);

					let inl = 0;
					for (let i = 0; i < inliers.rows; i++) inl += inliers.ucharPtr(i, 0)[0] ? 1 : 0;
					confidence = inliers.rows ? inl / inliers.rows : 1;

					const a = A.data64F && A.data64F.length ? Array.from(A.data64F) : Array.from(A.data32F);

					const m3 = [a[0], a[1], a[2], a[3], a[4], a[5], 0, 0, 1];
					H = wcv.matFromArray(3, 3, wcv.CV_64F, m3);

					inliers.delete();
					A.delete();
				} else {
					const src3 = wcv.matFromArray(3, 1, wcv.CV_32FC2, srcFlat.slice(0, 6));
					const dst3 = wcv.matFromArray(3, 1, wcv.CV_32FC2, dstFlat.slice(0, 6));

					const A = wcv.getAffineTransform(src3, dst3);
					const a = A.data64F && A.data64F.length ? Array.from(A.data64F) : Array.from(A.data32F);

					const m3 = [a[0], a[1], a[2], a[3], a[4], a[5], 0, 0, 1];
					H = wcv.matFromArray(3, 3, wcv.CV_64F, m3);

					src3.delete();
					dst3.delete();
					A.delete();
				}
			} else {
				transformType = 'homography';
				mask = new wcv.Mat();

				H = wcv.findHomography(
					srcPts,
					dstPts,
					wcv.RANSAC,
					ransacReprojThreshold,
					mask,
					ransacMaxIters,
					ransacConfidence
				);

				let inliers = 0;
				for (let i = 0; i < mask.rows; i++) inliers += mask.ucharPtr(i, 0)[0] ? 1 : 0;
				confidence = mask.rows ? inliers / mask.rows : 0;

				if (!H || (typeof H.empty === 'function' && H.empty())) {
					showToast('Homography failed. Try more points or adjust outliers.');
					return;
				}
			}

			previewCanvas.width = targetImg.naturalWidth;
			previewCanvas.height = targetImg.naturalHeight;

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
					gridActive,
					lockToGridCells,
					grid: gridActive ? { rows: gridRows, cols: gridCols, margin: gridMargin } : null,
					ransac:
						n >= 4 ? { reprojThreshold: ransacReprojThreshold, maxIters: ransacMaxIters } : null,
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
			if (mask) mask.delete();
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

		ctx.globalAlpha = 1;
		ctx.drawImage(targetImg, 0, 0, out.width, out.height);

		ctx.globalAlpha = overlayOpacity / 100;
		ctx.drawImage(previewCanvas, 0, 0, out.width, out.height);

		ctx.globalAlpha = 1;

		await downloadCanvas(out, 'aligned-composite.png');
	}

	async function exportDifference() {
		if (!previewCanvas || !targetImg || !computed) return;

		const out = document.createElement('canvas');
		out.width = previewCanvas.width;
		out.height = previewCanvas.height;

		const ctx = out.getContext('2d');
		if (!ctx) return;

		ctx.globalCompositeOperation = 'source-over';
		ctx.drawImage(targetImg, 0, 0, out.width, out.height);

		ctx.globalCompositeOperation = 'difference';
		ctx.drawImage(previewCanvas, 0, 0, out.width, out.height);

		ctx.globalCompositeOperation = 'source-over';

		await downloadCanvas(out, 'aligned-difference.png');
	}
</script>

<div class="tool">
	<div class="tool-header">
		<div class="left">
			<div class="name">Multi-point alignment</div>
			<div class="hint">
				Seed a <b>grid</b> (recommended) or click the <b>target</b> to add pairs. Adjust points on
				the <b>source</b> by <b>dragging markers</b> (no click-to-move).
			</div>
		</div>

		<div class="right">
			<span class="chip">{pairs.length}/{maxPairs} pairs</span>

			<button class="btn" type="button" on:click={undoLast} disabled={pairs.length === 0}
				>Undo</button
			>
			<button class="btn" type="button" on:click={resetAll} disabled={pairs.length === 0}
				>Reset</button
			>

			<button
				class="btn primary"
				type="button"
				on:click={compute}
				disabled={!cvReady || pairs.length < 3}
			>
				Compute
			</button>

			<button class="btn" type="button" on:click={exportWarped} disabled={!computed}
				>Export warped</button
			>
			<button class="btn" type="button" on:click={exportComposite} disabled={!computed}
				>Export composite</button
			>
			<button class="btn" type="button" on:click={exportDifference} disabled={!computed}
				>Export difference</button
			>

			<button class="btn save" type="button" on:click={save} disabled={!computed}
				>Save alignment</button
			>
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

	<div class="gridbar">
		<div class="grid-left">
			<div class="grid-title">Grid seed</div>

			<label class="field"
				>Rows <input type="number" min="2" max="12" bind:value={gridRows} /></label
			>
			<label class="field"
				>Cols <input type="number" min="2" max="12" bind:value={gridCols} /></label
			>
			<label class="field">
				Margin <input type="number" min="0" max="0.2" step="0.01" bind:value={gridMargin} />
			</label>

			<button class="btn" type="button" on:click={seedGrid}>Seed grid</button>

			<label class="toggle">
				<input type="checkbox" bind:checked={lockToGridCells} />
				Lock to grid cells
			</label>
		</div>

		<div class="grid-right">
			{#if gridActive}
				<div class="grid-tools">
					<div class="grid-title">Nudge / scale / rotate source grid</div>

					<div class="row">
						<button class="btn" type="button" on:click={() => translateSource(0, -0.005)}>↑</button>
						<button class="btn" type="button" on:click={() => translateSource(-0.005, 0)}>←</button>
						<button class="btn" type="button" on:click={() => translateSource(0.005, 0)}>→</button>
						<button class="btn" type="button" on:click={() => translateSource(0, 0.005)}>↓</button>
					</div>

					<div class="row">
						<button class="btn" type="button" on:click={() => scaleSource(0.98)}>- scale</button>
						<button class="btn" type="button" on:click={() => scaleSource(1.02)}>+ scale</button>
						<button class="btn" type="button" on:click={() => rotateSource(-1)}>- rot</button>
						<button class="btn" type="button" on:click={() => rotateSource(1)}>+ rot</button>
					</div>
				</div>
			{:else}
				<div class="grid-hint">
					Tip: seeding a 4×4 or 5×5 grid usually gets you a good alignment fast, then you just tweak
					a few points.
				</div>
			{/if}
		</div>
	</div>

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
						class="kp"
						class:active={i === adjustIndex}
						style="left: {p.target.x * 100}%; top: {p.target.y * 100}%"
						on:click|stopPropagation={() => (adjustIndex = i)}
						on:pointerdown|stopPropagation={(e) =>
							targetWrap && startDrag(e, 'target', i, targetWrap)}
						on:pointerup|stopPropagation={endDrag}
						on:pointercancel|stopPropagation={endDrag}
					>
						<div class="kp-ring" aria-hidden="true">
							<div class="kp-dot" aria-hidden="true" />
						</div>
						<div class="kp-label" aria-hidden="true">{i + 1}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="img-block">
			<div class="block-title">Source (to align)</div>

			<!-- ✅ NO wrapper click handler here -->
			<div
				class="img-wrap source"
				bind:this={sourceWrap}
				on:pointermove={(e) => sourceWrap && drag?.side === 'source' && moveDrag(e, sourceWrap)}
			>
				<img bind:this={sourceImg} src={sourceUrl} alt="Source image" draggable="false" />

				{#each pairs as p, i (i)}
					<div
						class="kp"
						class:active={i === adjustIndex}
						style="left: {p.source.x * 100}%; top: {p.source.y * 100}%"
						on:click|stopPropagation={() => (adjustIndex = i)}
						on:pointerdown|stopPropagation={(e) =>
							sourceWrap && startDrag(e, 'source', i, sourceWrap)}
						on:pointerup|stopPropagation={endDrag}
						on:pointercancel|stopPropagation={endDrag}
					>
						<div class="kp-ring" aria-hidden="true">
							<div class="kp-dot" aria-hidden="true" />
						</div>
						<div class="kp-label" aria-hidden="true">{i + 1}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="pairs">
		<div class="pairs-title">Point pairs</div>

		{#if pairs.length === 0}
			<div class="pairs-empty">Seed a grid, or click the target image to add point #1.</div>
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
	/* (same styles as before, plus small source cursor tweak) */

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
		max-width: 75ch;
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

	.gridbar {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 0.75rem;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.6rem 0.7rem;
		background: rgba(255, 255, 255, 0.75);
	}

	.grid-left,
	.grid-right {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.grid-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		margin-right: 0.15rem;
	}

	.field {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: #334155;
	}

	.field input {
		width: 64px;
		padding: 0.2rem 0.35rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: #334155;
	}

	.grid-tools {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.grid-tools .row {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.grid-hint {
		font-size: 0.8rem;
		color: #64748b;
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

	/* ✅ Source should not imply click-to-place */
	.img-wrap.source {
		cursor: default;
	}

	.img-wrap img {
		width: 100%;
		height: auto;
		display: block;
		user-select: none;
	}

	.kp {
		position: absolute;
		transform: translate(-50%, -50%);
		z-index: 5;
		touch-action: none;
		cursor: crosshair;
	}

	.kp-ring {
		--s: 18px;

		width: var(--s);
		height: var(--s);
		border-radius: 999px;

		background: rgba(255, 255, 255, 0.75);
		border: 2px solid rgba(17, 24, 39, 0.75);

		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(255, 255, 255, 0.35);

		display: grid;
		place-items: center;
	}

	.kp-dot {
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: rgba(17, 24, 39, 0.95);
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6);
	}

	.kp-label {
		position: absolute;
		left: 100%;
		top: 0;
		transform: translate(6px, -8px);

		padding: 0.12rem 0.38rem;
		border-radius: 999px;

		font-size: 11px;
		font-weight: 700;
		line-height: 1;

		background: rgba(17, 24, 39, 0.9);
		color: white;

		border: 1px solid rgba(255, 255, 255, 0.22);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);

		pointer-events: none;
	}

	.kp.active .kp-ring {
		outline: 2px solid rgba(2, 132, 199, 0.85);
		outline-offset: 2px;
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
