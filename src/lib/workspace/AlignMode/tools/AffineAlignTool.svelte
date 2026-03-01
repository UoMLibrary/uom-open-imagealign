<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';
	import type { ImageAlignment } from '$lib/core/types';

	export type AlignmentDraft = {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	};

	/**
	 * Semantics:
	 * - Source = BASE image (click to add points)
	 * - Target = MOVING image (warped onto Source)
	 * - Result = OSD base layer (Source) + canvas overlay (warp) so viewport never resets
	 */
	export let sourceUrl: string; // base image
	export let targetUrl: string; // moving image (to align)
	export let existingAlignment: ImageAlignment | null = null;

	// Svelte 5 callback prop
	export let onSave: (draft: AlignmentDraft) => void;

	// OpenCV.js
	export let opencvSrc = 'https://docs.opencv.org/4.x/opencv.js';

	// Drawer choice (helps reduce the WebGLDrawer readback warning if set to 'canvas')
	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	// Point limits + RANSAC
	export let maxPairs = 120;
	export let ransacReprojThreshold = 4.0;
	export let ransacMaxIters = 2000;
	export let ransacConfidence = 0.995;

	// Optional safety: require Shift+click to add points on source
	export let requireShiftToAdd = false;

	type Pt = { x: number; y: number }; // normalised 0..1
	type Pair = { source: Pt; target: Pt }; // source=base, target=moving

	let pairs: Pair[] = [];
	let adjustIndex: number | null = null;

	let overlayOpacity = 60;
	let resultMode: 'warped' | 'composite' | 'difference' = 'composite';

	// OpenCV state
	let cvReady = false;
	let cvError: string | null = null;

	// Seadragon containers
	let srcEl: HTMLDivElement | null = null;
	let tgtEl: HTMLDivElement | null = null;
	let resEl: HTMLDivElement | null = null;

	// Seadragon viewers
	let srcViewer: OpenSeadragon.Viewer | null = null; // base
	let tgtViewer: OpenSeadragon.Viewer | null = null; // moving
	let resViewer: OpenSeadragon.Viewer | null = null; // result

	// Image sizes in pixels (from OSD content size)
	let srcSize: { w: number; h: number } | null = null; // base size (source)
	let tgtSize: { w: number; h: number } | null = null; // moving size (target)
	let resSize: { w: number; h: number } | null = null; // result base size

	// Result layering
	let resBaseItem: any = null; // OpenSeadragon.TiledImage
	let resOverlayCanvas: HTMLCanvasElement | null = null;
	let resOverlayAdded = false;

	// Alignment output
	let computed: {
		transform: ImageAlignment['transform'];
		confidence: number;
		methodData?: any;
	} | null = null;

	/* -------------------------------------------------
	   Helpers
	------------------------------------------------- */

	function clamp01(v: number) {
		return Math.max(0, Math.min(1, v));
	}

	function isMarkerEventFromOriginalEvent(originalEvent: any) {
		const el = (originalEvent?.target as HTMLElement | null) ?? null;
		return !!el?.closest?.('.kp');
	}

	function getContentSize(viewer: OpenSeadragon.Viewer) {
		const item = viewer.world.getItemAt(0);
		if (!item) return null;
		const sz = item.getContentSize();
		return { w: sz.x, h: sz.y };
	}

	function normToViewportPoint(viewer: OpenSeadragon.Viewer, pt: Pt) {
		const size = getContentSize(viewer);
		if (!size) return null;
		const imgPoint = new OpenSeadragon.Point(pt.x * size.w, pt.y * size.h);
		return viewer.viewport.imageToViewportCoordinates(imgPoint);
	}

	function clientToNorm(viewer: OpenSeadragon.Viewer, clientX: number, clientY: number): Pt | null {
		const size = getContentSize(viewer);
		if (!size) return null;

		const rect = viewer.container.getBoundingClientRect();
		const px = clientX - rect.left;
		const py = clientY - rect.top;

		const pixelPoint = new OpenSeadragon.Point(px, py);
		const vpPoint = viewer.viewport.pointFromPixel(pixelPoint, true);
		const imgPoint = viewer.viewport.viewportToImageCoordinates(vpPoint);

		return {
			x: clamp01(imgPoint.x / size.w),
			y: clamp01(imgPoint.y / size.h)
		};
	}

	function centerOn(viewer: OpenSeadragon.Viewer | null, pt: Pt, immediate = false) {
		if (!viewer) return;
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;
		viewer.viewport.panTo(vp, immediate);
	}

	function centerOnPair(i: number, immediate = false) {
		const p = pairs[i];
		if (!p) return;
		centerOn(srcViewer, p.source, immediate);
		centerOn(tgtViewer, p.target, immediate);
	}

	function selectPair(i: number) {
		adjustIndex = i;
		refreshOverlays();
		centerOnPair(i, false);
	}

	function getMouseNavEnabled(viewer: OpenSeadragon.Viewer): boolean {
		const v: any = viewer as any;
		if (typeof v.isMouseNavEnabled === 'function') return v.isMouseNavEnabled();
		// fallback if some build exposes it as a property
		if (typeof v.mouseNavEnabled === 'boolean') return v.mouseNavEnabled;
		return true;
	}

	/* -------------------------------------------------
	   OpenSeadragon init / teardown
	------------------------------------------------- */

	function makeViewer(el: HTMLElement) {
		return OpenSeadragon({
			element: el,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',
			showNavigator: true,
			autoResize: true,

			// Use canvas drawer by default to avoid WebGL-related readback noise
			drawer,

			// Zoom behaviour (matching your known-good component)
			minZoomLevel: 0.1,
			maxZoomLevel: 20,
			maxZoomPixelRatio: 5,

			crossOriginPolicy: 'Anonymous',
			keyboardNavEnabled: false,

			gestureSettingsKeyboard: { rotate: false },

			gestureSettingsMouse: {
				dragToPan: true,
				clickToZoom: false,
				scrollToZoom: true,
				dblClickToZoom: false,
				pinchToZoom: true,

				// ✅ match your working component (avoid MouseButton.* enum differences)
				dragToPanButton: true
			},

			showFullPageControl: false,
			showHomeControl: true,
			showZoomControl: true
		});
	}

	function openImage(viewer: OpenSeadragon.Viewer, url: string) {
		viewer.open({ type: 'image', url });
		viewer.addOnceHandler('open', () => {
			if (viewer === srcViewer) srcSize = getContentSize(viewer);
			if (viewer === tgtViewer) tgtSize = getContentSize(viewer);
			if (viewer === resViewer) {
				resSize = getContentSize(viewer);
				resBaseItem = resViewer?.world.getItemAt(0) ?? null;
				ensureResultOverlay();
				applyResultMode();
			}
			refreshOverlays();
		});
	}

	let openedSourceUrl: string | null = null;
	let openedTargetUrl: string | null = null;
	let openedResultBaseUrl: string | null = null;

	onMount(async () => {
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

		if (srcEl) srcViewer = makeViewer(srcEl);
		if (tgtEl) tgtViewer = makeViewer(tgtEl);
		if (resEl) resViewer = makeViewer(resEl);

		if (srcViewer && sourceUrl) {
			openedSourceUrl = sourceUrl;
			openImage(srcViewer, sourceUrl);
		}
		if (tgtViewer && targetUrl) {
			openedTargetUrl = targetUrl;
			openImage(tgtViewer, targetUrl);
		}
		if (resViewer && sourceUrl) {
			openedResultBaseUrl = sourceUrl;
			openImage(resViewer, sourceUrl);
		}

		// Add points by clicking SOURCE (base)
		srcViewer?.addHandler('canvas-click', (ev: any) => {
			if (!srcViewer) return;
			if (!ev?.quick) return;

			const oe = ev.originalEvent as MouseEvent;
			if (isMarkerEventFromOriginalEvent(oe)) return;
			if (requireShiftToAdd && !oe.shiftKey) return;

			if (pairs.length >= maxPairs) return;

			const vpPoint = srcViewer.viewport.pointFromPixel(ev.position, true);
			const imgPoint = srcViewer.viewport.viewportToImageCoordinates(vpPoint);
			const size = getContentSize(srcViewer);
			if (!size) return;

			const basePt: Pt = { x: clamp01(imgPoint.x / size.w), y: clamp01(imgPoint.y / size.h) };

			pairs = [...pairs, { source: basePt, target: { ...basePt } }];
			adjustIndex = pairs.length - 1;

			computed = null;
			refreshOverlays();

			// Center TARGET on new point so it’s easy to find
			centerOn(tgtViewer, { ...basePt }, false);

			requestAutoCompute();
		});

		resViewer?.addHandler('resize', () => ensureResultOverlay());

		// OpenCV
		try {
			await ensureOpenCV();
			cvReady = true;
		} catch (e: any) {
			cvError = e?.message ?? String(e);
		}
	});

	onDestroy(() => {
		stopDrag();
		srcViewer?.destroy();
		tgtViewer?.destroy();
		resViewer?.destroy();
	});

	$: if (srcViewer && sourceUrl && openedSourceUrl !== sourceUrl) {
		openedSourceUrl = sourceUrl;
		openImage(srcViewer, sourceUrl);
	}
	$: if (tgtViewer && targetUrl && openedTargetUrl !== targetUrl) {
		openedTargetUrl = targetUrl;
		openImage(tgtViewer, targetUrl);
	}
	$: if (resViewer && sourceUrl && openedResultBaseUrl !== sourceUrl) {
		openedResultBaseUrl = sourceUrl;
		openImage(resViewer, sourceUrl);
	}

	/* -------------------------------------------------
	   Point overlays
	------------------------------------------------- */

	function createMarkerEl(label: string, active: boolean) {
		const el = document.createElement('div');
		el.className = 'kp' + (active ? ' active' : '');
		el.innerHTML = `
			<div class="kp-ring"><div class="kp-dot"></div></div>
			<div class="kp-label">${label}</div>
		`;
		return el;
	}

	function placeOverlayPoint(viewer: OpenSeadragon.Viewer, el: HTMLElement, pt: Pt) {
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;
		viewer.addOverlay({ element: el, location: vp, placement: OpenSeadragon.Placement.CENTER });
	}

	function updateOverlayPoint(viewer: OpenSeadragon.Viewer, el: HTMLElement, pt: Pt) {
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;
		viewer.updateOverlay(el, vp, OpenSeadragon.Placement.CENTER);
	}

	type DragState = {
		side: 'source' | 'target';
		index: number;
		viewer: OpenSeadragon.Viewer;
		el: HTMLElement;
		pointerId: number;
		temp: Pt | null;
		navEnabledBefore: boolean;
	};

	let drag: DragState | null = null;

	function refreshOverlays() {
		if (drag) return;

		srcViewer?.clearOverlays();
		tgtViewer?.clearOverlays();

		if (!srcViewer || !tgtViewer) return;

		pairs.forEach((p, i) => {
			const isActive = i === adjustIndex;

			const sEl = createMarkerEl(String(i + 1), isActive);
			sEl.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				selectPair(i);
			});
			sEl.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, 'source', i, srcViewer!, sEl)
			);
			placeOverlayPoint(srcViewer!, sEl, p.source);

			const tEl = createMarkerEl(String(i + 1), isActive);
			tEl.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				selectPair(i);
			});
			tEl.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, 'target', i, tgtViewer!, tEl)
			);
			placeOverlayPoint(tgtViewer!, tEl, p.target);
		});
	}

	function startDrag(
		e: PointerEvent,
		side: 'target' | 'source',
		index: number,
		viewer: OpenSeadragon.Viewer,
		el: HTMLElement
	) {
		e.preventDefault();
		e.stopPropagation();

		el.setPointerCapture(e.pointerId);
		el.classList.add('dragging');

		// ✅ correct API
		const navEnabledBefore = getMouseNavEnabled(viewer);
		viewer.setMouseNavEnabled(false);

		drag = { side, index, viewer, el, pointerId: e.pointerId, temp: null, navEnabledBefore };
		adjustIndex = index;

		window.addEventListener('pointermove', onDragMove, { passive: false });
		window.addEventListener('pointerup', onDragEnd, { passive: false });
		window.addEventListener('pointercancel', onDragEnd, { passive: false });
	}

	function onDragMove(e: PointerEvent) {
		if (!drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const pt = clientToNorm(drag.viewer, e.clientX, e.clientY);
		if (!pt) return;

		drag.temp = pt;
		updateOverlayPoint(drag.viewer, drag.el, pt);
	}

	function onDragEnd(e: PointerEvent) {
		if (!drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const { side, index, temp, viewer, navEnabledBefore } = drag;
		stopDrag();

		viewer.setMouseNavEnabled(navEnabledBefore);

		if (!temp) {
			refreshOverlays();
			return;
		}

		const next = [...pairs];
		const p = next[index];
		if (!p) return;

		next[index] = side === 'source' ? { ...p, source: temp } : { ...p, target: temp };
		pairs = next;

		computed = null;
		refreshOverlays();
		requestAutoCompute();
	}

	function stopDrag() {
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
		window.removeEventListener('pointercancel', onDragEnd);

		if (drag?.el) drag.el.classList.remove('dragging');
		drag = null;
	}

	function removePair(i: number) {
		pairs = pairs.filter((_, idx) => idx !== i);
		if (pairs.length === 0) adjustIndex = null;
		else if (adjustIndex != null) adjustIndex = Math.min(adjustIndex, pairs.length - 1);

		computed = null;
		refreshOverlays();
		requestAutoCompute();
	}

	function resetAll() {
		pairs = [];
		adjustIndex = null;
		computed = null;
		refreshOverlays();
		clearResultOverlay();
	}

	function undoLast() {
		if (!pairs.length) return;
		pairs = pairs.slice(0, -1);
		adjustIndex = pairs.length ? pairs.length - 1 : null;

		computed = null;
		refreshOverlays();
		requestAutoCompute();
	}

	/* -------------------------------------------------
	   Result layer: base OSD item + overlay canvas
	------------------------------------------------- */

	function ensureResultOverlay() {
		if (!resViewer) return;
		if (!resBaseItem) resBaseItem = resViewer.world.getItemAt(0);
		if (!resBaseItem) return;

		const size = resSize ?? srcSize;
		if (!size) return;

		if (!resOverlayCanvas) {
			resOverlayCanvas = document.createElement('canvas');
			resOverlayCanvas.className = 'result-overlay';
			resOverlayCanvas.width = size.w;
			resOverlayCanvas.height = size.h;
			resOverlayCanvas.getContext('2d', { willReadFrequently: true });
		}

		if (resOverlayCanvas.width !== size.w || resOverlayCanvas.height !== size.h) {
			resOverlayCanvas.width = size.w;
			resOverlayCanvas.height = size.h;
			resOverlayCanvas.getContext('2d', { willReadFrequently: true });
		}

		const bounds = resBaseItem.getBounds();

		if (!resOverlayAdded) {
			resViewer.addOverlay({ element: resOverlayCanvas, location: bounds });
			resOverlayAdded = true;
		} else {
			resViewer.updateOverlay(resOverlayCanvas, bounds);
		}
	}

	function clearResultOverlay() {
		if (!resOverlayCanvas) return;
		const ctx = resOverlayCanvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;
		ctx.clearRect(0, 0, resOverlayCanvas.width, resOverlayCanvas.height);
	}

	function applyResultMode() {
		if (!resOverlayCanvas) return;

		if (resBaseItem?.setOpacity) {
			resBaseItem.setOpacity(resultMode === 'warped' ? 0 : 1);
		}

		if (resultMode === 'composite') {
			resOverlayCanvas.style.opacity = String(overlayOpacity / 100);
			resOverlayCanvas.style.mixBlendMode = 'normal';
		} else if (resultMode === 'difference') {
			resOverlayCanvas.style.opacity = '1';
			resOverlayCanvas.style.mixBlendMode = 'difference';
		} else {
			resOverlayCanvas.style.opacity = '1';
			resOverlayCanvas.style.mixBlendMode = 'normal';
		}
	}

	$: applyResultMode();

	/* -------------------------------------------------
	   OpenCV loader + compute
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

	function imreadNatural(url: string, cv: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				const c = document.createElement('canvas');
				c.width = img.naturalWidth;
				c.height = img.naturalHeight;

				const ctx = c.getContext('2d', { willReadFrequently: true });
				if (!ctx) return reject(new Error('Canvas 2D context unavailable'));

				ctx.drawImage(img, 0, 0);
				resolve(cv.imread(c));
			};
			img.onerror = () => reject(new Error('Failed to load image for OpenCV (CORS?)'));
			img.src = url;
		});
	}

	let canCompute = false;
	$: {
		const base = srcSize ?? resSize;
		canCompute = cvReady && pairs.length >= 3 && !!tgtSize && !!base;
	}

	let computing = false;
	let computeQueued = false;
	let autoTimer: any = null;

	function requestAutoCompute() {
		if (!canCompute) return;
		clearTimeout(autoTimer);
		autoTimer = setTimeout(() => void compute(), 120);
	}

	async function compute() {
		if (!canCompute) return;

		if (computing) {
			computeQueued = true;
			return;
		}
		computing = true;

		cvError = null;
		computed = null;

		const baseSize = (srcSize ?? resSize)!;
		const movingSize = tgtSize!;
		const wcv = (window as any).cv;

		let H: any = null;
		let srcPts: any = null;
		let dstPts: any = null;
		let mask: any = null;

		try {
			const n = pairs.length;

			const srcFlat: number[] = [];
			const dstFlat: number[] = [];

			for (const p of pairs) {
				srcFlat.push(p.target.x * movingSize.w, p.target.y * movingSize.h);
				dstFlat.push(p.source.x * baseSize.w, p.source.y * baseSize.h);
			}

			srcPts = wcv.matFromArray(n, 1, wcv.CV_32FC2, srcFlat);
			dstPts = wcv.matFromArray(n, 1, wcv.CV_32FC2, dstFlat);

			let confidence = 1;

			if (n === 3) {
				const A = wcv.getAffineTransform(srcPts, dstPts);
				const a = A.data64F && A.data64F.length ? Array.from(A.data64F) : Array.from(A.data32F);
				const m3 = [a[0], a[1], a[2], a[3], a[4], a[5], 0, 0, 1];
				H = wcv.matFromArray(3, 3, wcv.CV_64F, m3);
				A.delete();
			} else {
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
					cvError = 'Homography failed. Add more points or fix outliers.';
					return;
				}
			}

			ensureResultOverlay();
			applyResultMode();
			if (!resOverlayCanvas) {
				cvError = 'Result overlay not ready.';
				return;
			}

			const movingMat = await imreadNatural(targetUrl, wcv);
			const dstMat = new wcv.Mat();
			const dsize = new wcv.Size(baseSize.w, baseSize.h);

			wcv.warpPerspective(movingMat, dstMat, H, dsize);
			wcv.imshow(resOverlayCanvas, dstMat);

			movingMat.delete();
			dstMat.delete();

			const data = H.data64F && H.data64F.length ? Array.from(H.data64F) : Array.from(H.data32F);

			computed = {
				confidence,
				transform: { type: n === 3 ? 'affine' : 'homography', matrix: data },
				methodData: {
					pointCount: n,
					pairs,
					ransac:
						n >= 4 ? { reprojThreshold: ransacReprojThreshold, maxIters: ransacMaxIters } : null,
					base: 'source',
					moving: 'target'
				}
			};
		} catch (err: any) {
			console.error(err);
			cvError = err?.message ?? 'Alignment failed (see console).';
		} finally {
			if (srcPts) srcPts.delete();
			if (dstPts) dstPts.delete();
			if (mask) mask.delete();
			if (H) H.delete?.();

			computing = false;
			if (computeQueued) {
				computeQueued = false;
				requestAutoCompute();
			}
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

<div class="layout">
	<div class="topbar">
		<div class="title">Multi point alignment</div>

		<div class="actions">
			<div class="chip">{pairs.length}/{maxPairs} pairs</div>

			<label class="chip toggle">
				<input type="checkbox" bind:checked={requireShiftToAdd} />
				Shift+click to add
			</label>

			<button class="btn" type="button" on:click={undoLast} disabled={!pairs.length}>UNDO</button>
			<button class="btn" type="button" on:click={resetAll} disabled={!pairs.length}>RESET</button>

			<button class="btn primary" type="button" on:click={() => compute()} disabled={!canCompute}>
				COMPUTE
			</button>

			<button class="btn save" type="button" on:click={save} disabled={!computed}>SAVE</button>
		</div>
	</div>

	{#if cvError}
		<div class="error">{cvError}</div>
	{/if}

	<div class="pink-row">
		<section class="panel">
			<header>Source (base)</header>
			<div class="osd" bind:this={srcEl} />
		</section>

		<section class="panel">
			<header>Target (moving)</header>
			<div class="osd" bind:this={tgtEl} />
		</section>

		<section class="panel">
			<header class="result-head">
				<div>Result</div>
				<div class="result-controls">
					<select bind:value={resultMode}>
						<option value="warped">Warped</option>
						<option value="composite">Composite</option>
						<option value="difference">Difference</option>
					</select>

					{#if resultMode === 'composite'}
						<label class="opacity">
							Opacity
							<input type="range" min="0" max="100" bind:value={overlayOpacity} />
						</label>
					{/if}
				</div>
			</header>
			<div class="osd" bind:this={resEl} />
		</section>
	</div>

	<div class="pairs">
		<div class="pairs-head">
			<div>Point pairs</div>
			{#if computed}
				<div class="chip">
					{computed.transform.type} • conf {computed.confidence.toFixed(2)}
				</div>
			{/if}
		</div>

		{#if !pairs.length}
			<div class="pairs-empty">
				Click <b>Source</b> to add points{#if requireShiftToAdd}
					(hold Shift){/if}. Drag markers in either view. Compute runs automatically on release.
			</div>
		{:else}
			<div class="pairs-list">
				{#each pairs as p, i (i)}
					<div class="row" class:active={i === adjustIndex} on:click={() => selectPair(i)}>
						<div class="idx">{i + 1}</div>
						<div class="coords">
							<div>
								Base: <span class="mono">{p.source.x.toFixed(4)}, {p.source.y.toFixed(4)}</span>
							</div>
							<div>
								Move: <span class="mono">{p.target.x.toFixed(4)}, {p.target.y.toFixed(4)}</span>
							</div>
						</div>
						<button class="remove" type="button" on:click|stopPropagation={() => removePair(i)}>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.layout {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.92);
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.title {
		font-weight: 700;
		color: #111827;
	}

	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
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

	.btn.save {
		background: #d1fae5;
		color: #065f46;
		border-color: rgba(6, 95, 70, 0.25);
		font-weight: 700;
	}

	.chip {
		font-size: 0.75rem;
		color: #334155;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.toggle input {
		transform: translateY(1px);
	}

	.pink-row {
		display: grid;
		grid-template-columns: 1.15fr 1.15fr 1fr;
		gap: 10px;
		min-height: 420px;
	}

	.panel {
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 10px;
		overflow: hidden;
		background: rgba(253, 186, 200, 0.35);
		display: flex;
		flex-direction: column;
	}

	.panel header {
		padding: 8px 10px;
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(17, 24, 39, 0.85);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		background: rgba(255, 255, 255, 0.7);
	}

	.result-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.result-controls {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		font-weight: 400;
	}

	select {
		border: 1px solid rgba(0, 0, 0, 0.15);
		border-radius: 8px;
		padding: 4px 8px;
		background: white;
	}

	.opacity {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		color: #334155;
	}

	.osd {
		flex: 1;
		background: rgba(255, 255, 255, 0.65);
	}

	.error {
		border: 1px solid rgba(220, 38, 38, 0.25);
		background: rgba(254, 226, 226, 0.7);
		color: #7f1d1d;
		padding: 8px 10px;
		border-radius: 10px;
		font-size: 0.85rem;
	}

	.pairs {
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 10px;
		background: rgba(187, 247, 208, 0.45);
		padding: 10px;
	}

	.pairs-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		font-weight: 700;
		color: rgba(17, 24, 39, 0.85);
	}

	.pairs-empty {
		color: #334155;
		font-size: 0.85rem;
		padding: 6px 0;
	}

	.pairs-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: grid;
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(0, 0, 0, 0.06);
		cursor: pointer;
	}

	.row.active {
		outline: 2px solid rgba(2, 132, 199, 0.35);
	}

	.idx {
		font-weight: 800;
		color: #334155;
	}

	.coords {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		font-size: 0.82rem;
		color: #0f172a;
	}

	.mono {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.remove {
		all: unset;
		cursor: pointer;
		font-size: 0.78rem;
		padding: 4px 8px;
		border-radius: 8px;
		background: rgba(251, 191, 36, 0.22);
		border: 1px solid rgba(124, 45, 18, 0.18);
		color: #7c2d12;
	}

	/* ---------- Marker styling ---------- */
	:global(.kp) {
		position: absolute;
		transform: translate(-50%, -50%);
		touch-action: none;
		cursor: crosshair;
		pointer-events: auto;
	}

	:global(.kp-ring) {
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.8);
		border: 2px solid rgba(17, 24, 39, 0.75);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
		display: grid;
		place-items: center;
	}

	:global(.kp-dot) {
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: rgba(17, 24, 39, 0.95);
	}

	:global(.kp-label) {
		position: absolute;
		left: 100%;
		top: 0;
		transform: translate(6px, -8px);
		padding: 2px 6px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 800;
		background: rgba(17, 24, 39, 0.9);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.22);
		pointer-events: none;
	}

	:global(.kp.active .kp-ring) {
		outline: 2px solid rgba(2, 132, 199, 0.85);
		outline-offset: 2px;
	}

	/* While dragging: remove fill + hide centre dot */
	:global(.kp.dragging .kp-ring) {
		background: transparent;
	}

	:global(.kp.dragging .kp-dot) {
		opacity: 0;
	}

	/* Result overlay should not block OSD wheel/drag events */
	:global(.result-overlay) {
		pointer-events: none;
	}
</style>
