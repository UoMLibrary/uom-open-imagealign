<script context="module" lang="ts">
	import type { ImageAlignment } from '$lib/core/types';

	export type AlignmentDraft = {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	};
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	import ResultPanel from './ResultPanel.svelte';
	import PointPairs from './PointPairs.svelte';
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import OsdPointPanel, { type Pt } from './OsdPointPanel.svelte';

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

	type Pair = { source: Pt; target: Pt };

	let pairs: Pair[] = [];
	let adjustIndex: number | null = null;

	// Derived arrays (so we don't do pairs.map(...) inline in markup every render)
	let sourcePoints: Pt[] = [];
	let targetPoints: Pt[] = [];
	$: {
		sourcePoints = pairs.map((p) => p.source);
		targetPoints = pairs.map((p) => p.target);
	}

	let resultOverlayOpacity = 0.6;
	let resultMode: 'warped' | 'composite' | 'difference' = 'difference';

	// OpenCV
	let cvReady = false;
	let cvError: string | null = null;

	// OSD viewers (created inside OsdPointPanel, bound back to us)
	let srcViewer: OpenSeadragon.Viewer | null = null;
	let tgtViewer: OpenSeadragon.Viewer | null = null;

	// Image sizes (reported by OsdPointPanel on open)
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

	function centerOn(viewer: OpenSeadragon.Viewer | null, pt: Pt, immediate = false) {
		if (!viewer) return;
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;
		viewer.viewport.panTo(vp, immediate);
	}

	function stopAndClamp(v: OpenSeadragon.Viewer | null) {
		if (!v) return;
		// Stop any spring/momentum already in progress
		v.viewport.cancelAnimation?.();

		// Clamp viewport to image bounds (prevents “blank space drift”)
		v.viewport.applyConstraints?.(true);
	}

	function zoomAndCenterOn(
		viewer: OpenSeadragon.Viewer | null,
		pt: Pt,
		imageZoom: number,
		immediate = true
	) {
		if (!viewer) return;

		stopAndClamp(viewer);

		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;

		const vpZoom = viewer.viewport.imageToViewportZoom(imageZoom);

		// Do it immediately to avoid spring overshoot
		viewer.viewport.zoomTo(vpZoom, vp, immediate);
		viewer.viewport.panTo(vp, immediate);

		// Clamp again after the move
		viewer.viewport.applyConstraints?.(true);
	}

	function getHomeImageZoom(viewer: OpenSeadragon.Viewer) {
		const homeVpZoom = viewer.viewport.getHomeZoom();
		return viewer.viewport.viewportToImageZoom(homeVpZoom);
	}

	// Zoom tuning
	const SEED_ZOOM_MULT = 4; // initial 4-point seed zoom
	const SELECT_ZOOM_MULT = 8; // selecting a point pair zoom

	function withBothOpen(fn: () => void) {
		let pending = 0;

		function done() {
			pending -= 1;
			if (pending <= 0) fn();
		}

		const sReady = !!srcViewer?.world?.getItemAt?.(0);
		const tReady = !!tgtViewer?.world?.getItemAt?.(0);

		if (!sReady && srcViewer) {
			pending += 1;
			srcViewer.addOnceHandler('open', done);
		}
		if (!tReady && tgtViewer) {
			pending += 1;
			tgtViewer.addOnceHandler('open', done);
		}

		if (pending === 0) fn();
	}

	// How much above "home" counts as "user has zoomed in"
	const KEEP_ZOOM_THRESHOLD_MULT = 1.15; // tweak: 1.05–1.3

	function focusPairZoom(i: number, immediate = true) {
		const p = pairs[i];
		if (!p || !srcViewer || !tgtViewer) return;

		// Stop momentum so the viewport doesn't drift off into blank space
		srcViewer.viewport.cancelAnimation?.();
		tgtViewer.viewport.cancelAnimation?.();

		const home = getHomeImageZoom(srcViewer);
		const current = getImageZoomTarget(srcViewer); // current image zoom (not viewport zoom)

		// If the user is already zoomed in, keep that zoom.
		// If they're basically at home, apply your preferred "select zoom".
		const desiredImageZoom =
			current && current > home * KEEP_ZOOM_THRESHOLD_MULT ? current : home * SELECT_ZOOM_MULT;

		// Zoom (to desired) + pan source to source point
		zoomAndCenterOn(srcViewer, p.source, desiredImageZoom, immediate);

		// Keep target zoom aligned (either via syncZoom or explicit zoom)
		zoomAndCenterOn(tgtViewer, p.target, desiredImageZoom, immediate);

		// Clamp after moves (prevents blank-space drifting)
		srcViewer.viewport.applyConstraints?.(true);
		tgtViewer.viewport.applyConstraints?.(true);

		resultFocus = { ...p.source };
	}

	function selectPair(i: number) {
		adjustIndex = i;

		withBothOpen(() => {
			requestAnimationFrame(() => {
				focusPairZoom(i, true);
			});
		});
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

	let osdLinked = false;
	$: if (srcViewer && tgtViewer && !osdLinked) {
		syncZoom(srcViewer, tgtViewer);
		syncZoom(tgtViewer, srcViewer);

		syncHome(srcViewer, tgtViewer);
		syncHome(tgtViewer, srcViewer);

		osdLinked = true;
	}

	/* -------------------------------------------------
	   Pair mutations (used by OsdPointPanel callbacks)
	------------------------------------------------- */

	function addPairFromSource(pt: Pt) {
		if (pairs.length >= maxPairs) return;

		pairs = [...pairs, { source: pt, target: { ...pt } }];
		adjustIndex = pairs.length - 1;

		computed = null;
		warpedUrl = null;
		autoComputedOnce = false;

		// Focus newly added point
		withBothOpen(() => focusPairZoom(adjustIndex!, false, SELECT_ZOOM_MULT));

		requestAutoCompute();
	}

	function moveSourcePoint(index: number, pt: Pt) {
		const next = [...pairs];
		const p = next[index];
		if (!p) return;

		next[index] = { ...p, source: pt };
		pairs = next;

		adjustIndex = index;
		resultFocus = { ...pt };

		computed = null;
		requestAutoCompute();
	}

	function moveTargetPoint(index: number, pt: Pt) {
		const next = [...pairs];
		const p = next[index];
		if (!p) return;

		next[index] = { ...p, target: pt };
		pairs = next;

		adjustIndex = index;
		resultFocus = { ...next[index].source };

		computed = null;
		requestAutoCompute();
	}

	/* -------------------------------------------------
	   Initial 4 points (plain + smart-match)
	------------------------------------------------- */

	type Corner = 'tl' | 'tr' | 'br' | 'bl';

	function makeInsetCornerPoints(inset = 0.07): Pt[] {
		const d = clamp01(inset);
		return [
			{ x: d, y: d }, // tl
			{ x: 1 - d, y: d }, // tr
			{ x: 1 - d, y: 1 - d }, // br
			{ x: d, y: 1 - d } // bl
		];
	}

	function seedFromPts(pts: Pt[]) {
		pairs = pts.map((p) => ({ source: { ...p }, target: { ...p } }));
		adjustIndex = 0;

		computed = null;
		warpedUrl = null;
		autoComputedOnce = false;

		withBothOpen(() => focusPairZoom(0, false, SEED_ZOOM_MULT));
		requestAutoCompute();
	}

	function addInitial4Points(inset = 0.07) {
		if (pairs.length) return;
		seedFromPts(makeInsetCornerPoints(inset));
	}

	async function addInitial4PointsSmart(inset = 0.07) {
		if (pairs.length) return;

		const fallbackPts = makeInsetCornerPoints(inset);

		if (!cvReady) {
			seedFromPts(fallbackPts);
			return;
		}

		const cv = (window as any).cv as any;
		if (!cv) {
			seedFromPts(fallbackPts);
			return;
		}

		// Tuning knobs
		const cornerRoiFrac = 0.35;
		const cornerInsetFrac = Math.max(0, Math.min(0.15, inset));
		const minGoodMatches = 4;
		const maxAcceptableDistance = 60;

		let baseRGBA: any = null;
		let movRGBA: any = null;
		let baseGray: any = null;
		let movGray: any = null;

		try {
			baseRGBA = await imreadNatural(sourceUrl, cv);
			movRGBA = await imreadNatural(targetUrl, cv);

			baseGray = rgbaToGray(baseRGBA, cv);
			movGray = rgbaToGray(movRGBA, cv);

			const baseW = baseGray.cols;
			const baseH = baseGray.rows;
			const movW = movGray.cols;
			const movH = movGray.rows;

			const corners: Corner[] = ['tl', 'tr', 'br', 'bl'];
			const nextPairs: Pair[] = [];

			for (let i = 0; i < corners.length; i++) {
				const c = corners[i];
				const fallback = fallbackPts[i];

				const baseRect = cornerRectPx(baseW, baseH, c, cornerRoiFrac, cornerInsetFrac, cv);
				const movRect = cornerRectPx(movW, movH, c, cornerRoiFrac, cornerInsetFrac, cv);

				let match = matchCornerROI(baseGray, movGray, baseRect, movRect, cv, {
					minGoodMatches,
					maxAcceptableDistance
				});

				// second chance: edge-pinned
				if (!match && cornerInsetFrac > 0) {
					const baseRect2 = cornerRectPx(baseW, baseH, c, cornerRoiFrac, 0, cv);
					const movRect2 = cornerRectPx(movW, movH, c, cornerRoiFrac, 0, cv);

					match = matchCornerROI(baseGray, movGray, baseRect2, movRect2, cv, {
						minGoodMatches,
						maxAcceptableDistance
					});
				}

				if (match) {
					nextPairs.push({
						source: { x: clamp01(match.base.x / baseW), y: clamp01(match.base.y / baseH) },
						target: { x: clamp01(match.moving.x / movW), y: clamp01(match.moving.y / movH) }
					});
				} else {
					nextPairs.push({ source: { ...fallback }, target: { ...fallback } });
				}
			}

			pairs = nextPairs;
			adjustIndex = 0;

			computed = null;
			warpedUrl = null;
			autoComputedOnce = false;

			withBothOpen(() => focusPairZoom(0, false, SEED_ZOOM_MULT));
			requestAutoCompute();
		} catch {
			seedFromPts(fallbackPts);
		} finally {
			try {
				baseRGBA?.delete?.();
				movRGBA?.delete?.();
				baseGray?.delete?.();
				movGray?.delete?.();
			} catch {
				// ignore
			}
		}
	}

	function rgbaToGray(rgba: any, cv: any) {
		const gray = new cv.Mat();
		cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY, 0);
		try {
			cv.equalizeHist(gray, gray);
		} catch {
			// ignore
		}
		return gray;
	}

	function cornerRectPx(
		w: number,
		h: number,
		corner: Corner,
		roiFrac: number,
		insetFrac: number,
		cv: any
	) {
		const inset = Math.max(0, Math.round(Math.min(w, h) * clamp01(insetFrac)));

		const safeW = Math.max(1, w - inset * 2);
		const safeH = Math.max(1, h - inset * 2);
		const safeMin = Math.min(safeW, safeH);

		const s = Math.max(64, Math.round(safeMin * clamp01(roiFrac)));

		const ww = Math.max(1, Math.min(s, safeW));
		const hh = Math.max(1, Math.min(s, safeH));

		const x0 = corner === 'tr' || corner === 'br' ? inset + (safeW - ww) : inset;
		const y0 = corner === 'bl' || corner === 'br' ? inset + (safeH - hh) : inset;

		return new cv.Rect(x0, y0, ww, hh);
	}

	function createORB(cv: any) {
		try {
			if (cv.ORB && typeof cv.ORB.create === 'function') return cv.ORB.create();
		} catch {}
		try {
			if (typeof cv.ORB === 'function') return new cv.ORB();
		} catch {}
		return null;
	}

	function median(values: number[]) {
		if (!values.length) return 0;
		const a = [...values].sort((x, y) => x - y);
		const mid = Math.floor(a.length / 2);
		return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
	}

	function matchCornerROI(
		baseGray: any,
		movingGray: any,
		baseRect: any,
		movingRect: any,
		cv: any,
		opts: { minGoodMatches: number; maxAcceptableDistance: number }
	): { base: { x: number; y: number }; moving: { x: number; y: number } } | null {
		const orb = createORB(cv);
		if (!orb) return null;

		let baseRoi: any = null;
		let movRoi: any = null;

		let kp1: any = null;
		let kp2: any = null;
		let des1: any = null;
		let des2: any = null;

		let mask1: any = null;
		let mask2: any = null;

		let matcher: any = null;
		let matches: any = null;

		try {
			baseRoi = baseGray.roi(baseRect);
			movRoi = movingGray.roi(movingRect);

			kp1 = new cv.KeyPointVector();
			kp2 = new cv.KeyPointVector();
			des1 = new cv.Mat();
			des2 = new cv.Mat();
			mask1 = new cv.Mat();
			mask2 = new cv.Mat();

			orb.detectAndCompute(baseRoi, mask1, kp1, des1);
			orb.detectAndCompute(movRoi, mask2, kp2, des2);

			if (!des1.rows || !des2.rows || des1.empty?.() || des2.empty?.()) return null;
			if (!kp1.size?.() || !kp2.size?.()) return null;

			matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
			matches = new cv.DMatchVector();
			matcher.match(des1, des2, matches);

			const mCount = matches.size();
			if (!mCount || mCount < opts.minGoodMatches) return null;

			const ms: { queryIdx: number; trainIdx: number; distance: number }[] = [];
			for (let i = 0; i < mCount; i++) {
				const m = matches.get(i);
				ms.push({ queryIdx: m.queryIdx, trainIdx: m.trainIdx, distance: m.distance });
			}
			ms.sort((a, b) => a.distance - b.distance);

			const best = ms[0];
			if (!best) return null;
			if (best.distance > opts.maxAcceptableDistance) return null;

			const distGate = Math.min(opts.maxAcceptableDistance, best.distance * 1.5 + 8);
			const good = ms.filter((m) => m.distance <= distGate).slice(0, 20);

			if (good.length < opts.minGoodMatches) return null;

			const baseXs: number[] = [];
			const baseYs: number[] = [];
			const movXs: number[] = [];
			const movYs: number[] = [];

			for (const m of good) {
				const k1 = kp1.get(m.queryIdx);
				const k2 = kp2.get(m.trainIdx);

				const p1 = k1.pt;
				const p2 = k2.pt;

				baseXs.push(baseRect.x + p1.x);
				baseYs.push(baseRect.y + p1.y);
				movXs.push(movingRect.x + p2.x);
				movYs.push(movingRect.y + p2.y);
			}

			return {
				base: { x: median(baseXs), y: median(baseYs) },
				moving: { x: median(movXs), y: median(movYs) }
			};
		} catch {
			return null;
		} finally {
			try {
				orb?.delete?.();

				baseRoi?.delete?.();
				movRoi?.delete?.();

				kp1?.delete?.();
				kp2?.delete?.();

				des1?.delete?.();
				des2?.delete?.();

				mask1?.delete?.();
				mask2?.delete?.();

				matcher?.delete?.();
				matches?.delete?.();
			} catch {
				// ignore
			}
		}
	}

	/* -------------------------------------------------
	   OpenCV loading + compute
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

	let autoComputedOnce = false;
	let computing = false;
	let computeQueued = false;
	let autoTimer: any = null;

	$: if (canCompute && pairs.length >= 4 && !autoComputedOnce && !computing) {
		autoComputedOnce = true;
		void compute();
	}

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
		try {
			await ensureOpenCV();
			cvReady = true;
		} catch (e: any) {
			cvError = e?.message ?? String(e);
		}
	});

	onDestroy(() => {
		clearTimeout(autoTimer);
	});

	/* -------------------------------------------------
	   UI helpers
	------------------------------------------------- */

	function removePair(i: number) {
		pairs = pairs.filter((_, idx) => idx !== i);
		if (pairs.length === 0) adjustIndex = null;
		else if (adjustIndex != null) adjustIndex = Math.min(adjustIndex, pairs.length - 1);

		computed = null;
		requestAutoCompute();
	}

	function resetAll() {
		pairs = [];
		adjustIndex = null;
		computed = null;
		warpedUrl = null;
		warpedRefreshKey += 1;
		resultFocus = null;
		autoComputedOnce = false;
	}

	function undoLast() {
		if (!pairs.length) return;
		pairs = pairs.slice(0, -1);
		adjustIndex = pairs.length ? pairs.length - 1 : null;
		computed = null;
		requestAutoCompute();
	}

	function clamp(v: number, min = 0, max = 100) {
		return Math.max(min, Math.min(max, v));
	}

	function wheelPixels(e: WheelEvent) {
		const dominant =
			Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0 ? e.deltaY : e.deltaX;

		if (e.deltaMode === 1) return dominant * 16;
		if (e.deltaMode === 2) return dominant * 800;
		return dominant;
	}

	let wheelPendingPx = 0;
	let wheelRaf = 0;

	function onResultWheel(e: WheelEvent) {
		if (!e.shiftKey) return;
		if (resultMode !== 'composite' && resultMode !== 'difference') return;
		if (!warpedUrl) return;

		e.preventDefault();
		e.stopPropagation();

		wheelPendingPx += wheelPixels(e);

		if (wheelRaf) return;
		wheelRaf = requestAnimationFrame(() => {
			wheelRaf = 0;

			const sensitivityPctPerPx = 0.05;
			const deltaPct = -wheelPendingPx * sensitivityPctPerPx;
			wheelPendingPx = 0;

			overlayOpacityPct = clamp(overlayOpacityPct + deltaPct);
		});
	}
</script>

<div class="layout">
	<div class="topbar">
		<div class="title">Manual align tool</div>

		<div class="actions">
			<div class="chip">{pairs.length}/{maxPairs} pairs</div>

			{#if pairs.length === 0}
				<button class="btn" type="button" on:click={() => void addInitial4PointsSmart(0.07)}>
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
				<div class="stack">
					<OsdPointPanel
						title="Source (base)"
						url={sourceUrl}
						{drawer}
						points={sourcePoints}
						activeIndex={adjustIndex}
						allowAdd={true}
						{requireShiftToAdd}
						maxPoints={maxPairs}
						onAdd={addPairFromSource}
						onSelect={selectPair}
						onMove={moveSourcePoint}
						onOpen={(s) => (srcSize = s)}
						bind:viewer={srcViewer}
					/>

					<OsdPointPanel
						title="Target (moving)"
						url={targetUrl}
						{drawer}
						points={targetPoints}
						activeIndex={adjustIndex}
						allowAdd={false}
						onSelect={selectPair}
						onMove={moveTargetPoint}
						onOpen={(s) => (tgtSize = s)}
						bind:viewer={tgtViewer}
					/>
				</div>

				<section class="panel">
					<header class="result-head">
						<div>Result</div>
						<div class="result-controls">
							{#if resultMode === 'composite' || resultMode === 'difference'}
								<label class="opacity">
									Opacity
									<input
										type="range"
										min="0"
										max="100"
										value={Math.round(resultOverlayOpacity * 100)}
										on:input={(e) =>
											(resultOverlayOpacity =
												Number((e.currentTarget as HTMLInputElement).value) / 100)}
									/>
								</label>
							{/if}
							<select bind:value={resultMode}>
								<option value="warped">Warped</option>
								<option value="composite">Composite</option>
								<option value="difference">Difference</option>
							</select>
						</div>
					</header>

					<div class="result-wheel-capture">
						{#if warpedUrl}
							<ResultPanel
								imageUrl={resultMode === 'warped' ? warpedUrl : sourceUrl}
								overlayUrl={resultMode === 'warped' ? null : warpedUrl}
								bind:overlayOpacity={resultOverlayOpacity}
								overlayCompositeOperation={resultMode === 'difference' ? 'difference' : null}
								refreshKey={warpedRefreshKey}
								mode={resultMode}
								focus={resultFocus}
								wheelAdjustOpacity={resultMode === 'composite' || resultMode === 'difference'}
								wheelAdjustRequiresShift={true}
								wheelSensitivityPctPerPx={0.05}
								{drawer}
							/>
						{:else}
							<div class="result-empty">No result yet — add points and compute.</div>
						{/if}
					</div>
				</section>
			</div>
		</div>

		<SidePanel side="right" bind:open={RightPanelOpen} width={280}>
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
					onAddCorners={() => void addInitial4PointsSmart(0.07)}
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
		grid-template-columns: 0.95fr 1.4fr;
		gap: 10px;
		min-height: 420px;
		height: 100%;
		min-height: 0;
	}

	.stack {
		display: grid;
		grid-template-rows: 1fr 1fr;
		gap: 10px;
		min-height: 0;
	}

	.panel {
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 10px;
		overflow: hidden;
		background: white;
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

	.result-wheel-capture {
		height: 100%;
		min-height: 0;
	}
</style>
