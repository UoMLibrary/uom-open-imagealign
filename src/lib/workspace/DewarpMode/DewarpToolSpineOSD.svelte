<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	export type Pt = { x: number; y: number };

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: Pt[];
		version: 1;
		method: 'spine-cubic-v2';
	};

	type CornerKey = 'tl' | 'tr' | 'bl' | 'br';
	type EditMode = 'corners' | 'curve';

	type SpineState = {
		// where the spine bar attaches horizontally
		topT: number; // along TL->TR
		bottomT: number; // along BL->BR

		// how far the endpoints extend beyond the top/bottom in the "down" direction basis
		topExtend: number; // + means above (against downDir)
		bottomExtend: number; // + means below (along downDir)

		// cubic handles as offsets from P0 and P3
		h1: Pt; // offset from P0
		h2: Pt; // offset from P3
	};

	export let imageUrl: string;
	export let rows = 14;
	export let cols = 12;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	export let onConfirm: (mesh: DewarpMesh) => void;
	export let onMeshChange: ((mesh: DewarpMesh) => void) | undefined;

	let hostEl: HTMLDivElement | null = null;
	let svgEl: SVGSVGElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	// Start in corners mode (first thing you do)
	let editMode: EditMode = 'corners';

	let showCurves = true;
	let showGrid = true;

	let corners: Record<CornerKey, Pt> = {
		tl: { x: 0.12, y: 0.08 },
		tr: { x: 0.88, y: 0.08 },
		bl: { x: 0.12, y: 0.92 },
		br: { x: 0.88, y: 0.92 }
	};

	// Default: slightly above + slightly below the quad
	let spine: SpineState = {
		topT: 0.22,
		bottomT: 0.26,
		topExtend: 0.04,
		bottomExtend: 0.04,
		h1: { x: 0.0, y: 0.18 },
		h2: { x: 0.0, y: -0.18 }
	};

	// OSD overlay handles
	let cornerEls: Partial<Record<CornerKey, HTMLElement>> = {};
	let p0El: HTMLElement | null = null;
	let p3El: HTMLElement | null = null;
	let midEl: HTMLElement | null = null;
	let h1El: HTMLElement | null = null;
	let h2El: HTMLElement | null = null;

	let overlaySet: WeakSet<HTMLElement> = new WeakSet();

	let rafDraw = 0;
	let rafEmit = 0;
	let ro: ResizeObserver | null = null;
	let currentUrl: string | null = null;

	/* -------------------------------------------------
	   Math helpers
	------------------------------------------------- */

	function clamp(v: number, a: number, b: number) {
		return Math.max(a, Math.min(b, v));
	}
	function lerp(a: Pt, b: Pt, t: number): Pt {
		return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
	}
	function sub(a: Pt, b: Pt): Pt {
		return { x: a.x - b.x, y: a.y - b.y };
	}
	function add(a: Pt, b: Pt): Pt {
		return { x: a.x + b.x, y: a.y + b.y };
	}
	function mul(a: Pt, s: number): Pt {
		return { x: a.x * s, y: a.y * s };
	}
	function dot(a: Pt, b: Pt) {
		return a.x * b.x + a.y * b.y;
	}
	function len(a: Pt) {
		return Math.sqrt(a.x * a.x + a.y * a.y);
	}
	function norm(a: Pt): Pt {
		const l = len(a);
		return l < 1e-9 ? { x: 0, y: 1 } : { x: a.x / l, y: a.y / l };
	}

	function cubicBezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
		const u = 1 - t;
		const uu = u * u;
		const tt = t * t;
		const uuu = uu * u;
		const ttt = tt * t;
		return {
			x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
			y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
		};
	}

	function quadBezier(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
		const u = 1 - t;
		return {
			x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
			y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
		};
	}

	// Even spacing across a quadratic curve (approx arc-length)
	function sampleEvenQuadratic(p0: Pt, p1: Pt, p2: Pt, count: number, steps = 80): Pt[] {
		if (count <= 1) return [p0];

		const ts: number[] = [];
		const pts: Pt[] = [];
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			ts.push(t);
			pts.push(quadBezier(p0, p1, p2, t));
		}

		const cum: number[] = [0];
		for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
		const total = cum[cum.length - 1];

		if (total < 1e-9) {
			return Array.from({ length: count }, (_, i) => lerp(p0, p2, i / (count - 1)));
		}

		function tAtFrac(frac: number) {
			const target = frac * total;
			let j = 1;
			while (j < cum.length && cum[j] < target) j++;
			if (j >= cum.length) return 1;

			const aLen = cum[j - 1];
			const bLen = cum[j];
			const alpha = bLen - aLen < 1e-9 ? 0 : (target - aLen) / (bLen - aLen);
			return ts[j - 1] + (ts[j] - ts[j - 1]) * alpha;
		}

		const out: Pt[] = [];
		for (let i = 0; i < count; i++) out.push(quadBezier(p0, p1, p2, tAtFrac(i / (count - 1))));
		return out;
	}

	/* -------------------------------------------------
	   Spine geometry with extend above/below
	------------------------------------------------- */

	function downDir(): Pt {
		const midTop = lerp(corners.tl, corners.tr, 0.5);
		const midBot = lerp(corners.bl, corners.br, 0.5);
		const d = sub(midBot, midTop);
		const nd = norm(d);
		// fallback if degenerate
		if (Math.abs(nd.x) < 1e-9 && Math.abs(nd.y) < 1e-9) return { x: 0, y: 1 };
		return nd;
	}

	function topEdgePoint(): Pt {
		return lerp(corners.tl, corners.tr, spine.topT);
	}
	function bottomEdgePoint(): Pt {
		return lerp(corners.bl, corners.br, spine.bottomT);
	}

	// P0 is above the top edge by topExtend along -downDir
	function P0(): Pt {
		const d = downDir();
		return add(topEdgePoint(), mul(d, -spine.topExtend));
	}

	// P3 is below the bottom edge by bottomExtend along +downDir
	function P3(): Pt {
		const d = downDir();
		return add(bottomEdgePoint(), mul(d, spine.bottomExtend));
	}

	function P1(): Pt {
		return add(P0(), spine.h1);
	}
	function P2(): Pt {
		return add(P3(), spine.h2);
	}

	function rowLR(v: number) {
		return {
			L: lerp(corners.tl, corners.bl, v),
			R: lerp(corners.tr, corners.br, v)
		};
	}

	// Control point sampled slightly inside to let top/bottom rows bow
	function spineTForRow(v: number) {
		const eps = Math.min(0.06, 1 / Math.max(8, rows * 1.5));
		return clamp(v, eps, 1 - eps);
	}

	function deriveMeshPoints(): Pt[] {
		const out: Pt[] = [];
		const p0 = P0();
		const p1 = P1();
		const p2 = P2();
		const p3 = P3();

		for (let r = 0; r < rows; r++) {
			const v = rows === 1 ? 0.5 : r / (rows - 1);
			const { L, R } = rowLR(v);
			const C = cubicBezier(p0, p1, p2, p3, spineTForRow(v));
			out.push(...sampleEvenQuadratic(L, C, R, cols));
		}

		return out;
	}

	function currentMesh(): DewarpMesh {
		return { rows, cols, points: deriveMeshPoints(), version: 1, method: 'spine-cubic-v2' };
	}

	function scheduleEmitMesh() {
		if (!onMeshChange) return;
		if (rafEmit) return;
		rafEmit = requestAnimationFrame(() => {
			rafEmit = 0;
			onMeshChange?.(currentMesh());
		});
	}

	/* -------------------------------------------------
	   OpenSeadragon helpers + zoom controls
	------------------------------------------------- */

	function getContentSize(v: OpenSeadragon.Viewer) {
		const item = v.world.getItemAt(0);
		if (!item) return null;
		const sz = item.getContentSize();
		return { w: sz.x, h: sz.y };
	}

	function normToViewportPoint(v: OpenSeadragon.Viewer, pt: Pt) {
		const size = getContentSize(v);
		if (!size) return null;
		const imgPoint = new OpenSeadragon.Point(pt.x * size.w, pt.y * size.h);
		return v.viewport.imageToViewportCoordinates(imgPoint);
	}

	function clientToNorm(v: OpenSeadragon.Viewer, clientX: number, clientY: number): Pt | null {
		const size = getContentSize(v);
		if (!size) return null;

		const rect = v.container.getBoundingClientRect();
		const px = clientX - rect.left;
		const py = clientY - rect.top;

		const pixelPoint = new OpenSeadragon.Point(px, py);
		const vpPoint = v.viewport.pointFromPixel(pixelPoint, true);
		const imgPoint = v.viewport.viewportToImageCoordinates(vpPoint);

		return { x: imgPoint.x / size.w, y: imgPoint.y / size.h };
	}

	function makeViewer(el: HTMLElement) {
		return OpenSeadragon({
			element: el,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',
			showNavigator: true,
			autoResize: true,
			drawer,
			crossOriginPolicy: 'Anonymous',
			keyboardNavEnabled: false,

			// ✅ allow zooming out beyond home
			visibilityRatio: 0.0,
			constrainDuringPan: false,
			minZoomImageRatio: 0.05,

			gestureSettingsKeyboard: { rotate: false },
			gestureSettingsMouse: {
				dragToPan: true,
				clickToZoom: false,
				scrollToZoom: true,
				dblClickToZoom: false,
				pinchToZoom: true,
				dragToPanButton: true
			},
			showFullPageControl: false,
			showHomeControl: true,
			showZoomControl: true
		});
	}

	function getMouseNavEnabled(v: OpenSeadragon.Viewer): boolean {
		const anyV: any = v as any;
		if (typeof anyV.isMouseNavEnabled === 'function') return anyV.isMouseNavEnabled();
		return true;
	}

	function zoomBy(f: number) {
		if (!viewer) return;
		const z = viewer.viewport.getZoom(true);
		viewer.viewport.zoomTo(z * f, undefined, true);
	}

	function fitHome() {
		if (!viewer) return;
		viewer.viewport.goHome(true);
	}

	/* -------------------------------------------------
	   Overlay helpers + modes
	------------------------------------------------- */

	function createHandleEl(kind: 'corner' | 'anchor' | 'mid' | 'handle') {
		const el = document.createElement('div');
		el.className = `h ${kind}`;
		el.innerHTML = `<div class="ring"><div class="dot"></div></div>`;
		el.style.zIndex = '30';
		return el;
	}

	function addOrUpdateOverlay(el: HTMLElement, pt: Pt) {
		if (!viewer) return;
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;

		if (!overlaySet.has(el)) {
			viewer.addOverlay({ element: el, location: vp, placement: OpenSeadragon.Placement.CENTER });
			overlaySet.add(el);
		} else {
			viewer.updateOverlay(el, vp, OpenSeadragon.Placement.CENTER);
		}
	}

	function setInteractive(el: HTMLElement, enabled: boolean) {
		el.style.pointerEvents = enabled ? 'auto' : 'none';
		el.style.opacity = enabled ? '1' : '0.35';
	}

	function applyEditMode() {
		const cornersEnabled = editMode === 'corners';
		const curveEnabled = editMode === 'curve';

		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = cornerEls[k];
			if (el) setInteractive(el, cornersEnabled);
		});

		if (p0El) setInteractive(p0El, curveEnabled);
		if (p3El) setInteractive(p3El, curveEnabled);
		if (midEl) setInteractive(midEl, curveEnabled);
		if (h1El) setInteractive(h1El, curveEnabled);
		if (h2El) setInteractive(h2El, curveEnabled);
	}

	function rebuildOverlays() {
		if (!viewer) return;

		viewer.clearOverlays();
		overlaySet = new WeakSet();

		cornerEls = {};
		p0El = p3El = midEl = h1El = h2El = null;

		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = createHandleEl('corner');
			el.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'corner', corner: k, el })
			);
			cornerEls[k] = el;
			addOrUpdateOverlay(el, corners[k]);
		});

		p0El = createHandleEl('anchor');
		p0El.addEventListener('pointerdown', (e) =>
			startDrag(e as PointerEvent, { kind: 'p0', el: p0El! })
		);
		addOrUpdateOverlay(p0El, P0());

		p3El = createHandleEl('anchor');
		p3El.addEventListener('pointerdown', (e) =>
			startDrag(e as PointerEvent, { kind: 'p3', el: p3El! })
		);
		addOrUpdateOverlay(p3El, P3());

		midEl = createHandleEl('mid');
		midEl.addEventListener('pointerdown', (e) =>
			startDrag(e as PointerEvent, { kind: 'mid', el: midEl! })
		);
		addOrUpdateOverlay(midEl, lerp(P0(), P3(), 0.5));

		h1El = createHandleEl('handle');
		h1El.addEventListener('pointerdown', (e) =>
			startDrag(e as PointerEvent, { kind: 'h1', el: h1El! })
		);
		addOrUpdateOverlay(h1El, P1());

		h2El = createHandleEl('handle');
		h2El.addEventListener('pointerdown', (e) =>
			startDrag(e as PointerEvent, { kind: 'h2', el: h2El! })
		);
		addOrUpdateOverlay(h2El, P2());

		applyEditMode();
		scheduleRedraw();
		scheduleEmitMesh();
	}

	function refreshOverlayPositions() {
		if (!viewer) return;

		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = cornerEls[k];
			if (el) addOrUpdateOverlay(el, corners[k]);
		});

		if (p0El) addOrUpdateOverlay(p0El, P0());
		if (p3El) addOrUpdateOverlay(p3El, P3());
		if (midEl) addOrUpdateOverlay(midEl, lerp(P0(), P3(), 0.5));
		if (h1El) addOrUpdateOverlay(h1El, P1());
		if (h2El) addOrUpdateOverlay(h2El, P2());
	}

	/* -------------------------------------------------
	   Converting dragged points back into (t,extend)
	------------------------------------------------- */

	function projectTOnSegment(pt: Pt, a: Pt, b: Pt) {
		const ab = sub(b, a);
		const ap = sub(pt, a);
		const denom = dot(ab, ab);
		if (denom < 1e-12) return 0.5;
		return dot(ap, ab) / denom;
	}

	function setP0FromPoint(pt: Pt) {
		const t = projectTOnSegment(pt, corners.tl, corners.tr);
		const tClamped = clamp(t, -0.2, 1.2);

		const edgePt = lerp(corners.tl, corners.tr, tClamped);
		const d = downDir();

		// pt = edgePt + (-topExtend)*d  => topExtend = -dot(pt-edgePt, d)
		const topExtend = -dot(sub(pt, edgePt), d);

		spine = {
			...spine,
			topT: tClamped,
			topExtend: clamp(topExtend, -0.25, 0.5)
		};
	}

	function setP3FromPoint(pt: Pt) {
		const t = projectTOnSegment(pt, corners.bl, corners.br);
		const tClamped = clamp(t, -0.2, 1.2);

		const edgePt = lerp(corners.bl, corners.br, tClamped);
		const d = downDir();

		// pt = edgePt + bottomExtend*d  => bottomExtend = dot(pt-edgePt, d)
		const bottomExtend = dot(sub(pt, edgePt), d);

		spine = {
			...spine,
			bottomT: tClamped,
			bottomExtend: clamp(bottomExtend, -0.25, 0.5)
		};
	}

	/* -------------------------------------------------
	   Dragging
	------------------------------------------------- */

	type DragTarget =
		| { kind: 'corner'; corner: CornerKey; el: HTMLElement }
		| { kind: 'p0'; el: HTMLElement }
		| { kind: 'p3'; el: HTMLElement }
		| { kind: 'mid'; el: HTMLElement }
		| { kind: 'h1'; el: HTMLElement }
		| { kind: 'h2'; el: HTMLElement };

	type DragState = {
		target: DragTarget;
		pointerId: number;
		navEnabledBefore: boolean;
		// for mid-drag
		startMid?: Pt;
		startP0?: Pt;
		startP3?: Pt;
	};

	let drag: DragState | null = null;

	function startDrag(e: PointerEvent, target: DragTarget) {
		if (!viewer) return;

		if (editMode === 'corners' && target.kind !== 'corner') return;
		if (editMode === 'curve' && target.kind === 'corner') return;

		e.preventDefault();
		e.stopPropagation();

		target.el.setPointerCapture(e.pointerId);
		target.el.classList.add('dragging');

		const navEnabledBefore = getMouseNavEnabled(viewer);
		viewer.setMouseNavEnabled(false);

		if (target.kind === 'mid') {
			const p0 = P0();
			const p3 = P3();
			drag = {
				target,
				pointerId: e.pointerId,
				navEnabledBefore,
				startMid: lerp(p0, p3, 0.5),
				startP0: p0,
				startP3: p3
			};
		} else {
			drag = { target, pointerId: e.pointerId, navEnabledBefore };
		}

		window.addEventListener('pointermove', onDragMove, { passive: false });
		window.addEventListener('pointerup', onDragEnd, { passive: false });
		window.addEventListener('pointercancel', onDragEnd, { passive: false });
	}

	function onDragMove(e: PointerEvent) {
		if (!viewer || !drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const pt = clientToNorm(viewer, e.clientX, e.clientY);
		if (!pt) return;

		if (drag.target.kind === 'corner') {
			corners = { ...corners, [drag.target.corner]: pt };
			addOrUpdateOverlay(drag.target.el, pt);
			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'p0') {
			setP0FromPoint(pt);
			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'p3') {
			setP3FromPoint(pt);
			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'mid') {
			if (!drag.startMid || !drag.startP0 || !drag.startP3) return;

			const delta = sub(pt, drag.startMid);
			const newP0 = add(drag.startP0, delta);
			const newP3 = add(drag.startP3, delta);

			// Convert back to (t,extend)
			setP0FromPoint(newP0);
			setP3FromPoint(newP3);

			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'h1') {
			const p0 = P0();
			spine = { ...spine, h1: sub(pt, p0) };
			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'h2') {
			const p3 = P3();
			spine = { ...spine, h2: sub(pt, p3) };
			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}
	}

	function onDragEnd(e: PointerEvent) {
		if (!viewer || !drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		viewer.setMouseNavEnabled(drag.navEnabledBefore);
		drag.target.el.classList.remove('dragging');

		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
		window.removeEventListener('pointercancel', onDragEnd);

		drag = null;
	}

	/* -------------------------------------------------
	   SVG drawing
	------------------------------------------------- */

	function scheduleRedraw() {
		if (!viewer || !svgEl) return;
		if (rafDraw) return;
		rafDraw = requestAnimationFrame(() => {
			rafDraw = 0;
			redraw();
		});
	}

	function normToPixel(pt: Pt) {
		if (!viewer) return { x: -9999, y: -9999 };
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return { x: -9999, y: -9999 };
		const px = viewer.viewport.pixelFromPoint(vp, true);
		return { x: px.x, y: px.y };
	}

	function redraw() {
		if (!viewer || !svgEl) return;
		if (!viewer.world.getItemAt(0)) return;

		const rect = viewer.container.getBoundingClientRect();
		const w = Math.max(1, Math.floor(rect.width));
		const h = Math.max(1, Math.floor(rect.height));
		svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

		while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

		const pTL = normToPixel(corners.tl);
		const pTR = normToPixel(corners.tr);
		const pBR = normToPixel(corners.br);
		const pBL = normToPixel(corners.bl);

		const border = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		border.setAttribute(
			'd',
			`M ${pTL.x} ${pTL.y} L ${pTR.x} ${pTR.y} L ${pBR.x} ${pBR.y} L ${pBL.x} ${pBL.y} Z`
		);
		border.setAttribute('class', 'border');
		svgEl.appendChild(border);

		// draw bar (P0->P3) + spine curve + handle lines
		const P0p = P0();
		const P1p = P1();
		const P2p = P2();
		const P3p = P3();

		const p0 = normToPixel(P0p);
		const p1 = normToPixel(P1p);
		const p2 = normToPixel(P2p);
		const p3 = normToPixel(P3p);

		const barLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		barLine.setAttribute('class', 'bar');
		barLine.setAttribute('x1', String(p0.x));
		barLine.setAttribute('y1', String(p0.y));
		barLine.setAttribute('x2', String(p3.x));
		barLine.setAttribute('y2', String(p3.y));
		svgEl.appendChild(barLine);

		const hLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		hLine1.setAttribute('class', 'handle-line');
		hLine1.setAttribute('x1', String(p0.x));
		hLine1.setAttribute('y1', String(p0.y));
		hLine1.setAttribute('x2', String(p1.x));
		hLine1.setAttribute('y2', String(p1.y));
		svgEl.appendChild(hLine1);

		const hLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		hLine2.setAttribute('class', 'handle-line');
		hLine2.setAttribute('x1', String(p3.x));
		hLine2.setAttribute('y1', String(p3.y));
		hLine2.setAttribute('x2', String(p2.x));
		hLine2.setAttribute('y2', String(p2.y));
		svgEl.appendChild(hLine2);

		const spinePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		spinePath.setAttribute('class', 'spine');
		spinePath.setAttribute(
			'd',
			`M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`
		);
		svgEl.appendChild(spinePath);

		// optionally draw a subset of row curves
		if (showCurves) {
			const step = Math.max(1, Math.floor(rows / 10));
			const must = new Set([0, rows - 1]);

			for (let r = 0; r < rows; r++) {
				if (!must.has(r) && r % step !== 0) continue;

				const v = rows === 1 ? 0.5 : r / (rows - 1);
				const { L, R } = rowLR(v);
				const C = cubicBezier(P0p, P1p, P2p, P3p, spineTForRow(v));

				const a = normToPixel(L);
				const b = normToPixel(C);
				const c = normToPixel(R);

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('class', must.has(r) ? 'curve edge-curve' : 'curve');
				path.setAttribute('d', `M ${a.x} ${a.y} Q ${b.x} ${b.y} ${c.x} ${c.y}`);
				svgEl.appendChild(path);
			}
		}

		// derived grid
		if (showGrid) {
			const pts = deriveMeshPoints();
			if (pts.length === rows * cols) {
				const pxPts = pts.map(normToPixel);

				for (let r = 0; r < rows; r++) {
					for (let c = 0; c < cols - 1; c++) {
						const i = r * cols + c;
						const j = r * cols + c + 1;
						const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
						line.setAttribute('class', 'grid');
						line.setAttribute('x1', String(pxPts[i].x));
						line.setAttribute('y1', String(pxPts[i].y));
						line.setAttribute('x2', String(pxPts[j].x));
						line.setAttribute('y2', String(pxPts[j].y));
						svgEl.appendChild(line);
					}
				}

				for (let c = 0; c < cols; c++) {
					for (let r = 0; r < rows - 1; r++) {
						const i = r * cols + c;
						const j = (r + 1) * cols + c;
						const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
						line.setAttribute('class', 'grid');
						line.setAttribute('x1', String(pxPts[i].x));
						line.setAttribute('y1', String(pxPts[i].y));
						line.setAttribute('x2', String(pxPts[j].x));
						line.setAttribute('y2', String(pxPts[j].y));
						svgEl.appendChild(line);
					}
				}
			}
		}
	}

	/* -------------------------------------------------
	   Actions
	------------------------------------------------- */

	function reset() {
		corners = {
			tl: { x: 0.12, y: 0.08 },
			tr: { x: 0.88, y: 0.08 },
			bl: { x: 0.12, y: 0.92 },
			br: { x: 0.88, y: 0.92 }
		};
		spine = {
			topT: 0.22,
			bottomT: 0.26,
			topExtend: 0.04,
			bottomExtend: 0.04,
			h1: { x: 0.0, y: 0.18 },
			h2: { x: 0.0, y: -0.18 }
		};

		editMode = 'corners';
		rebuildOverlays();
	}

	function confirm() {
		onConfirm?.(currentMesh());
	}

	function toggleMode() {
		editMode = editMode === 'corners' ? 'curve' : 'corners';
		applyEditMode();
	}

	/* -------------------------------------------------
	   Lifecycle
	------------------------------------------------- */

	onMount(() => {
		if (!hostEl) return;

		viewer = makeViewer(hostEl);

		svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgEl.classList.add('overlay');
		viewer.container.appendChild(svgEl);

		const schedule = () => scheduleRedraw();
		viewer.addHandler('animation', schedule);
		viewer.addHandler('zoom', schedule);
		viewer.addHandler('pan', schedule);
		viewer.addHandler('resize', schedule);

		ro = new ResizeObserver(() => scheduleRedraw());
		ro.observe(viewer.container);

		currentUrl = imageUrl;
		viewer.addOnceHandler('open', () => rebuildOverlays());
		viewer.open({ type: 'image', url: imageUrl });

		// start slightly zoomed out for context
		viewer.addOnceHandler('open', () => {
			const home = viewer!.viewport.getHomeZoom();
			viewer!.viewport.zoomTo(home * 0.85, undefined, true);
		});
	});

	$: if (viewer && imageUrl && imageUrl !== currentUrl) {
		currentUrl = imageUrl;
		viewer.clearOverlays();
		overlaySet = new WeakSet();
		viewer.addOnceHandler('open', () => rebuildOverlays());
		viewer.open({ type: 'image', url: imageUrl });
	}

	onDestroy(() => {
		if (rafDraw) cancelAnimationFrame(rafDraw);
		if (rafEmit) cancelAnimationFrame(rafEmit);
		ro?.disconnect();
		try {
			viewer?.destroy();
		} catch {}
		viewer = null;
	});
</script>

<div class="shell">
	<div class="viewer" bind:this={hostEl}></div>

	<div class="toolbar">
		<button class="btn" on:click={toggleMode}
			>Edit: {editMode === 'corners' ? 'Corners' : 'Curve'}</button
		>

		<button class="btn" on:click={() => zoomBy(0.8)}>Zoom -</button>
		<button class="btn" on:click={() => zoomBy(1.25)}>Zoom +</button>
		<button class="btn" on:click={fitHome}>Fit</button>

		<label class="tog"><input type="checkbox" bind:checked={showCurves} /> Curves</label>
		<label class="tog"><input type="checkbox" bind:checked={showGrid} /> Grid</label>

		<button class="btn" on:click={reset}>Reset</button>
		<button class="btn" on:click={confirm}>Confirm</button>
	</div>
</div>

<style>
	.shell {
		position: relative;
		width: 100%;
		height: 100%;
		background: #000;
		overflow: hidden;
	}

	.viewer {
		position: absolute;
		inset: 0;
	}

	.toolbar {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 50;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.btn {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 8px;
		padding: 0.45rem 0.7rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.tog {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 8px;
		padding: 0.35rem 0.55rem;
		font-size: 0.8rem;
	}

	:global(svg.overlay) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 10;
		pointer-events: none;
	}

	:global(.border) {
		fill: rgba(255, 255, 255, 0.02);
		stroke: rgba(255, 255, 255, 0.55);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	:global(.bar) {
		stroke: rgba(255, 255, 255, 0.32);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	:global(.spine) {
		fill: none;
		stroke: rgba(76, 159, 254, 0.85);
		stroke-width: 2.25;
		vector-effect: non-scaling-stroke;
	}

	:global(.handle-line) {
		stroke: rgba(255, 255, 255, 0.35);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	:global(.curve) {
		fill: none;
		stroke: rgba(76, 159, 254, 0.35);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	:global(.edge-curve) {
		stroke: rgba(76, 159, 254, 0.7);
	}

	:global(.grid) {
		stroke: rgba(255, 255, 255, 0.14);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	:global(.h) {
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		cursor: grab;
		touch-action: none;
	}

	:global(.h.dragging) {
		cursor: grabbing;
	}

	:global(.h.corner) {
		width: 26px;
		height: 26px;
	}

	:global(.h.anchor) {
		width: 22px;
		height: 22px;
	}

	:global(.h.mid) {
		width: 22px;
		height: 22px;
	}

	:global(.h.handle) {
		width: 18px;
		height: 18px;
	}

	:global(.ring) {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		border: 2px solid rgba(255, 255, 255, 0.92);
		background: rgba(0, 0, 0, 0.2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		display: grid;
		place-items: center;
	}

	:global(.h.corner .ring) {
		width: 22px;
		height: 22px;
	}

	:global(.dot) {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: #4c9ffe;
	}

	:global(.h.anchor .dot),
	:global(.h.mid .dot) {
		width: 8px;
		height: 8px;
	}
</style>
