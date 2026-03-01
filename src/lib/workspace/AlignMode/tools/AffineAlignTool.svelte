<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';
	import type { ImageAlignment } from '$lib/core/types';

	import ResultPanel from './ResultPanel.svelte';
	import PointPairs from './PointPairs.svelte';
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';

	export type AlignmentDraft = {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	};

	export let sourceUrl: string; // base
	export let targetUrl: string; // moving
	export let existingAlignment: ImageAlignment | null = null;

	export let onSave: (draft: AlignmentDraft) => void;

	export let opencvSrc = 'https://docs.opencv.org/4.x/opencv.js';
	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	export let maxPairs = 120;
	export let ransacReprojThreshold = 4.0;
	export let ransacMaxIters = 2000;
	export let ransacConfidence = 0.995;

	export let requireShiftToAdd = true;

	type Pt = { x: number; y: number }; // normalised 0..1
	type Pair = { source: Pt; target: Pt };

	let pairs: Pair[] = [];
	let adjustIndex: number | null = null;

	let overlayOpacityPct = 60; // 0..100 (UI)
	let resultMode: 'warped' | 'composite' | 'difference' = 'composite';

	// OpenCV
	let cvReady = false;
	let cvError: string | null = null;

	// OSD
	let srcEl: HTMLDivElement | null = null;
	let tgtEl: HTMLDivElement | null = null;

	let srcViewer: OpenSeadragon.Viewer | null = null;
	let tgtViewer: OpenSeadragon.Viewer | null = null;

	let srcSize: { w: number; h: number } | null = null;
	let tgtSize: { w: number; h: number } | null = null;

	// Warped output (data URL) + refresh key
	let warpedUrl: string | null = null;
	let warpedRefreshKey = 0;

	// Focus point for result panel (in source/base normalised space)
	let resultFocus: Pt | null = null;

	// Cached canvas for warp output
	let warpCanvas: HTMLCanvasElement | null = null;

	let computed: {
		transform: ImageAlignment['transform'];
		confidence: number;
		methodData?: any;
	} | null = null;

	let RightPanelOpen = true;

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

		return { x: clamp01(imgPoint.x / size.w), y: clamp01(imgPoint.y / size.h) };
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

		resultFocus = { ...p.source };
	}

	function selectPair(i: number) {
		adjustIndex = i;
		refreshOverlays();
		centerOnPair(i, false);
	}

	function getMouseNavEnabled(viewer: OpenSeadragon.Viewer): boolean {
		const v: any = viewer as any;
		if (typeof v.isMouseNavEnabled === 'function') return v.isMouseNavEnabled();
		return true;
	}

	/* -------------------------------------------------
	   OSD viewer setup
	------------------------------------------------- */

	function makeViewer(el: HTMLElement) {
		return OpenSeadragon({
			element: el,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',
			showNavigator: true,
			autoResize: true,
			drawer,
			crossOriginPolicy: 'Anonymous',
			keyboardNavEnabled: false,
			gestureSettingsKeyboard: { rotate: false },
			gestureSettingsMouse: {
				dragToPan: true,
				clickToZoom: false,
				scrollToZoom: true,
				dblClickToZoom: false,
				pinchToZoom: true,
				dragToPanButton: true
			},
			minZoomLevel: 0.1,
			maxZoomLevel: 20,
			maxZoomPixelRatio: 5,
			showFullPageControl: false,
			showHomeControl: true,
			showZoomControl: true
		});
	}

	function openImage(viewer: OpenSeadragon.Viewer, url: string) {
		viewer.addOnceHandler('open', () => {
			if (viewer === srcViewer) srcSize = getContentSize(viewer);
			if (viewer === tgtViewer) tgtSize = getContentSize(viewer);
			refreshOverlays();
		});
		viewer.open({ type: 'image', url });
	}

	/* -------------------------------------------------
	   Zoom sync + home sync (Source <-> Target)
	------------------------------------------------- */

	let syncingZoom = false;
	let syncingHome = false;

	function getImageZoomTarget(viewer: OpenSeadragon.Viewer) {
		const vpTargetZoom = viewer.viewport.getZoom(false);
		return viewer.viewport.viewportToImageZoom(vpTargetZoom);
	}

	function setImageZoomTarget(viewer: OpenSeadragon.Viewer, imageZoom: number) {
		const vpTargetZoom = viewer.viewport.imageToViewportZoom(imageZoom);
		const center = viewer.viewport.getCenter(true);
		viewer.viewport.zoomTo(vpTargetZoom, center, false);
	}

	function syncZoom(from: OpenSeadragon.Viewer, to: OpenSeadragon.Viewer) {
		const apply = () => {
			if (syncingZoom) return;
			syncingZoom = true;
			try {
				const iz = getImageZoomTarget(from);
				setImageZoomTarget(to, iz);
			} finally {
				queueMicrotask(() => (syncingZoom = false));
			}
		};

		from.addHandler('zoom', apply);
		from.addHandler('animation-finish', apply);
	}

	function getHomeImageZoom(viewer: OpenSeadragon.Viewer) {
		const homeVpZoom = viewer.viewport.getHomeZoom();
		return viewer.viewport.viewportToImageZoom(homeVpZoom);
	}

	function syncHome(from: OpenSeadragon.Viewer, to: OpenSeadragon.Viewer) {
		from.addHandler('home', () => {
			if (syncingHome) return;
			syncingHome = true;

			const homeImageZoom = getHomeImageZoom(from);

			from.viewport.goHome(false);
			to.viewport.goHome(false);

			setImageZoomTarget(from, homeImageZoom);
			setImageZoomTarget(to, homeImageZoom);

			let remaining = 2;
			const done = () => {
				remaining -= 1;
				if (remaining <= 0) syncingHome = false;
			};

			from.addOnceHandler('animation-finish', done);
			to.addOnceHandler('animation-finish', done);

			setTimeout(() => (syncingHome = false), 700);
		});
	}

	/* -------------------------------------------------
	   Markers
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

		resultFocus = { ...next[index].source };

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

	function addInitial4Points(inset = 0.07) {
		if (pairs.length) return;

		const d = clamp01(inset);
		const pts: Pt[] = [
			{ x: d, y: d },
			{ x: 1 - d, y: d },
			{ x: 1 - d, y: 1 - d },
			{ x: d, y: 1 - d }
		];

		pairs = pts.map((p) => ({ source: { ...p }, target: { ...p } }));
		adjustIndex = 0;

		refreshOverlays();
		centerOnPair(0, false);

		requestAutoCompute();
	}

	/* -------------------------------------------------
	   OpenCV
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
	$: canCompute = cvReady && pairs.length >= 3 && !!srcSize && !!tgtSize;

	let computing = false;
	let computeQueued = false;
	let autoTimer: any = null;

	function requestAutoCompute() {
		if (!canCompute) return;
		clearTimeout(autoTimer);
		autoTimer = setTimeout(() => void compute(), 120);
	}

	async function ensureWarpCanvas() {
		if (!srcSize) return;
		if (!warpCanvas) {
			warpCanvas = document.createElement('canvas');
			warpCanvas.getContext('2d', { willReadFrequently: true });
		}
		if (warpCanvas.width !== srcSize.w || warpCanvas.height !== srcSize.h) {
			warpCanvas.width = srcSize.w;
			warpCanvas.height = srcSize.h;
			warpCanvas.getContext('2d', { willReadFrequently: true });
		}
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

		const baseSize = srcSize!;
		const movingSize = tgtSize!;
		const wcv = (window as any).cv;

		let H: any = null;
		let srcPts: any = null;
		let dstPts: any = null;
		let mask: any = null;

		try {
			await ensureWarpCanvas();
			if (!warpCanvas) throw new Error('warpCanvas missing');

			const n = pairs.length;

			// H maps moving -> base
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
					throw new Error('Homography failed. Add more points or fix outliers.');
				}
			}

			const movingMat = await imreadNatural(targetUrl, wcv);
			const dstMat = new wcv.Mat();
			const dsize = new wcv.Size(baseSize.w, baseSize.h);

			wcv.warpPerspective(movingMat, dstMat, H, dsize);
			wcv.imshow(warpCanvas, dstMat);

			movingMat.delete();
			dstMat.delete();

			// ✅ Only compute the warped bitmap once per compute
			warpedUrl = warpCanvas.toDataURL('image/png');
			warpedRefreshKey += 1;

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

	/* -------------------------------------------------
	   Lifecycle
	------------------------------------------------- */

	onMount(async () => {
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

		if (srcEl) srcViewer = makeViewer(srcEl);
		if (tgtEl) tgtViewer = makeViewer(tgtEl);

		if (srcViewer && sourceUrl) openImage(srcViewer, sourceUrl);
		if (tgtViewer && targetUrl) openImage(tgtViewer, targetUrl);

		if (srcViewer && tgtViewer) {
			syncZoom(srcViewer, tgtViewer);
			syncZoom(tgtViewer, srcViewer);

			syncHome(srcViewer, tgtViewer);
			syncHome(tgtViewer, srcViewer);
		}

		// Add points by clicking Source (base)
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

			resultFocus = { ...basePt };
			centerOn(tgtViewer, { ...basePt }, false);

			computed = null;
			refreshOverlays();
			requestAutoCompute();
		});

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
	});

	$: if (srcViewer && sourceUrl) openImage(srcViewer, sourceUrl);
	$: if (tgtViewer && targetUrl) openImage(tgtViewer, targetUrl);

	/* -------------------------------------------------
	   UI helpers
	------------------------------------------------- */

	function removePair(i: number) {
		pairs = pairs.filter((_, idx) => idx !== i);
		if (pairs.length === 0) adjustIndex = null;
		else if (adjustIndex != null) adjustIndex = Math.min(adjustIndex, pairs.length - 1);

		refreshOverlays();
		requestAutoCompute();
	}

	function resetAll() {
		pairs = [];
		adjustIndex = null;
		computed = null;
		warpedUrl = null;
		warpedRefreshKey += 1;
		resultFocus = null;
		refreshOverlays();
	}

	function undoLast() {
		if (!pairs.length) return;
		pairs = pairs.slice(0, -1);
		adjustIndex = pairs.length ? pairs.length - 1 : null;
		refreshOverlays();
		requestAutoCompute();
	}
</script>

<div class="layout">
	<div class="topbar">
		<div class="title">Affine align tool</div>

		<div class="actions">
			<div class="chip">{pairs.length}/{maxPairs} pairs</div>

			{#if pairs.length === 0}
				<button class="btn" type="button" on:click={() => addInitial4Points(0.07)}>
					Add 4 corner points
				</button>
			{/if}

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

	<div class="content">
		<div class="workspace">
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
									<input
										type="range"
										min="0"
										max="100"
										value={overlayOpacityPct}
										on:input={(e) =>
											(overlayOpacityPct = Number((e.currentTarget as HTMLInputElement).value))}
									/>
								</label>
							{/if}
						</div>
					</header>

					<div class="result-shell">
						{#if warpedUrl}
							<ResultPanel
								imageUrl={resultMode === 'warped' ? warpedUrl : sourceUrl}
								overlayUrl={resultMode === 'warped' ? null : warpedUrl}
								overlayOpacity={overlayOpacityPct / 100}
								overlayCompositeOperation={resultMode === 'difference' ? 'difference' : null}
								refreshKey={warpedRefreshKey}
								mode={resultMode}
								focus={resultFocus}
								{drawer}
							/>
						{:else}
							<div class="result-empty">No result yet — add points and compute.</div>
						{/if}
					</div>
				</section>
			</div>
		</div>

		<SidePanel side="right" bind:open={RightPanelOpen} width={420}>
			<svelte:fragment slot="header">
				<div class="sidebar-header">
					<div class="panel-title">PointPairs</div>
					{#if computed}
						<div class="chip">
							{computed.transform.type} • conf {computed.confidence.toFixed(2)}
						</div>
					{/if}
				</div>
			</svelte:fragment>

			<div class="sidebar-body">
				<PointPairs
					{pairs}
					{maxPairs}
					activeIndex={adjustIndex}
					onSelect={selectPair}
					onRemove={removePair}
					onAddCorners={() => addInitial4Points(0.07)}
				/>
			</div>
		</SidePanel>
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
		height: 100%;
		min-height: 0;
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
		white-space: nowrap;
	}

	.toggle input {
		transform: translateY(1px);
	}

	.error {
		border: 1px solid rgba(220, 38, 38, 0.25);
		background: rgba(254, 226, 226, 0.7);
		color: #7f1d1d;
		padding: 8px 10px;
		border-radius: 10px;
		font-size: 0.85rem;
	}

	.content {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: 10px;
		position: relative;
	}

	.workspace {
		flex: 1;
		min-height: 0;
	}

	.pink-row {
		display: grid;
		grid-template-columns: 1.15fr 1.15fr 1fr;
		gap: 10px;
		min-height: 420px;
		height: 100%;
	}

	.panel {
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 10px;
		overflow: hidden;
		background: rgba(253, 186, 200, 0.35);
		display: flex;
		flex-direction: column;
		min-height: 0;
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

	.result-shell {
		flex: 1;
		min-height: 0;
	}

	.result-empty {
		padding: 12px;
		font-size: 0.85rem;
		color: #334155;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 0.75rem 0.75rem 0.5rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}

	.panel-title {
		font-weight: 700;
		color: rgba(17, 24, 39, 0.85);
	}

	.sidebar-body {
		padding: 0.75rem;
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

	:global(.kp.dragging .kp-ring) {
		background: transparent;
	}

	:global(.kp.dragging .kp-dot) {
		opacity: 0;
	}
</style>
