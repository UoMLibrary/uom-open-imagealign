<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	export type Pt = { x: number; y: number };

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: Pt[];
		version: 1;
		method: 'spine-cubic-v1';
	};

	type CornerKey = 'tl' | 'tr' | 'bl' | 'br';
	type EditMode = 'corners' | 'curve';

	type SpineState = {
		topT: number; // along TL->TR
		bottomT: number; // along BL->BR
		h1: Pt; // handle offset from P0 (absolute offset in normalised coords)
		h2: Pt; // handle offset from P3
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

	let editMode: EditMode = 'curve';
	let showCurves = true;
	let showGrid = true;

	let corners: Record<CornerKey, Pt> = {
		tl: { x: 0.12, y: 0.08 },
		tr: { x: 0.88, y: 0.08 },
		bl: { x: 0.12, y: 0.92 },
		br: { x: 0.88, y: 0.92 }
	};

	let spine: SpineState = {
		topT: 0.22,
		bottomT: 0.26,
		h1: { x: 0.0, y: 0.18 },
		h2: { x: 0.0, y: -0.18 }
	};

	let cornerEls: Partial<Record<CornerKey, HTMLElement>> = {};
	let p0El: HTMLElement | null = null;
	let p3El: HTMLElement | null = null;
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
	   Geometry from state
	------------------------------------------------- */

	function P0(): Pt {
		return lerp(corners.tl, corners.tr, spine.topT);
	}
	function P3(): Pt {
		return lerp(corners.bl, corners.br, spine.bottomT);
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

	function deriveMeshPoints(): Pt[] {
		const out: Pt[] = [];
		const p0 = P0();
		const p1 = P1();
		const p2 = P2();
		const p3 = P3();

		for (let r = 0; r < rows; r++) {
			const v = rows === 1 ? 0.5 : r / (rows - 1);
			const { L, R } = rowLR(v);
			const C = cubicBezier(p0, p1, p2, p3, v); // control column “near spine”
			out.push(...sampleEvenQuadratic(L, C, R, cols));
		}
		return out;
	}

	function currentMesh(): DewarpMesh {
		return { rows, cols, points: deriveMeshPoints(), version: 1, method: 'spine-cubic-v1' };
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
	   OpenSeadragon helpers
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

	/* -------------------------------------------------
	   Overlay helpers + modes
	------------------------------------------------- */

	function createHandleEl(kind: 'corner' | 'anchor' | 'handle') {
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
		if (h1El) setInteractive(h1El, curveEnabled);
		if (h2El) setInteractive(h2El, curveEnabled);
	}

	function rebuildOverlays() {
		if (!viewer) return;

		viewer.clearOverlays();
		overlaySet = new WeakSet();

		cornerEls = {};
		p0El = p3El = h1El = h2El = null;

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
		if (h1El) addOrUpdateOverlay(h1El, P1());
		if (h2El) addOrUpdateOverlay(h2El, P2());
	}

	/* -------------------------------------------------
	   Dragging
	------------------------------------------------- */

	type DragTarget =
		| { kind: 'corner'; corner: CornerKey; el: HTMLElement }
		| { kind: 'p0'; el: HTMLElement }
		| { kind: 'p3'; el: HTMLElement }
		| { kind: 'h1'; el: HTMLElement }
		| { kind: 'h2'; el: HTMLElement };

	type DragState = {
		target: DragTarget;
		pointerId: number;
		navEnabledBefore: boolean;
	};

	let drag: DragState | null = null;

	function projectToEdgeT(pt: Pt, a: Pt, b: Pt) {
		const ab = sub(b, a);
		const ap = sub(pt, a);
		const denom = dot(ab, ab);
		if (denom < 1e-9) return 0.5;
		return dot(ap, ab) / denom;
	}

	function startDrag(e: PointerEvent, target: DragTarget) {
		if (!viewer) return;

		// mode guard
		if (editMode === 'corners' && target.kind !== 'corner') return;
		if (editMode === 'curve' && target.kind === 'corner') return;

		e.preventDefault();
		e.stopPropagation();

		target.el.setPointerCapture(e.pointerId);
		target.el.classList.add('dragging');

		const navEnabledBefore = getMouseNavEnabled(viewer);
		viewer.setMouseNavEnabled(false);

		drag = { target, pointerId: e.pointerId, navEnabledBefore };

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
			// constrain to top edge TL->TR
			const t = projectToEdgeT(pt, corners.tl, corners.tr);
			spine = { ...spine, topT: clamp(t, -0.1, 1.1) };
			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'p3') {
			// constrain to bottom edge BL->BR
			const t = projectToEdgeT(pt, corners.bl, corners.br);
			spine = { ...spine, bottomT: clamp(t, -0.1, 1.1) };
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

		// spine curve
		const p0 = normToPixel(P0());
		const p1 = normToPixel(P1());
		const p2 = normToPixel(P2());
		const p3 = normToPixel(P3());

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

		if (showCurves) {
			// draw a subset of row curves so it’s readable
			const step = Math.max(1, Math.floor(rows / 12));
			for (let r = 0; r < rows; r += step) {
				const v = rows === 1 ? 0.5 : r / (rows - 1);
				const { L, R } = rowLR(v);
				const C = cubicBezier(P0(), P1(), P2(), P3(), v);

				const a = normToPixel(L);
				const b = normToPixel(C);
				const c = normToPixel(R);

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('class', 'curve');
				path.setAttribute('d', `M ${a.x} ${a.y} Q ${b.x} ${b.y} ${c.x} ${c.y}`);
				svgEl.appendChild(path);
			}
		}

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
			h1: { x: 0.0, y: 0.18 },
			h2: { x: 0.0, y: -0.18 }
		};

		rebuildOverlays();
	}

	function confirm() {
		onConfirm?.(currentMesh());
	}

	function setMode(mode: EditMode) {
		editMode = mode;
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
		} catch {
			// ignore
		}
		viewer = null;
	});
</script>

<div class="shell">
	<div class="viewer" bind:this={hostEl}></div>

	<div class="toolbar">
		<button
			class="btn {editMode === 'corners' ? 'active' : ''}"
			on:click={() => setMode('corners')}
		>
			Corners
		</button>
		<button class="btn {editMode === 'curve' ? 'active' : ''}" on:click={() => setMode('curve')}>
			Curve
		</button>

		<label class="tog">
			<input type="checkbox" bind:checked={showCurves} />
			Curves
		</label>
		<label class="tog">
			<input type="checkbox" bind:checked={showGrid} />
			Grid
		</label>

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

	.btn.active {
		outline: 2px solid rgba(76, 159, 254, 0.8);
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

	:global(.h.anchor .dot) {
		width: 8px;
		height: 8px;
	}
</style>
