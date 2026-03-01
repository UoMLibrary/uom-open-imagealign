<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	/* -------------------------------------------------
	   Types
	------------------------------------------------- */

	export type Pt = { x: number; y: number }; // normalised

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: Pt[]; // row-major (rows*cols)
		version: 1;
		method: 'bezier-rows-v1';
	};

	type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

	// Per-row:
	// - leftT / rightT : where endpoints sit on left/right edges (0..1)
	// - s,k : Bezier control point in chord coordinates
	//   C = L + s*(R-L) + k*|R-L|*n
	type RowParams = { leftT: number; rightT: number; s: number; k: number };

	/* -------------------------------------------------
	   Props
	------------------------------------------------- */

	export let imageUrl: string;

	// Number of guide rows = mesh rows (for now)
	export let rows = 12;

	// Number of columns sampled across each row
	export let cols = 10;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	// Svelte 5 callback props
	export let onConfirm: (mesh: DewarpMesh) => void;
	export let onMeshChange: ((mesh: DewarpMesh) => void) | undefined;

	/* -------------------------------------------------
	   Local State
	------------------------------------------------- */

	let hostEl: HTMLDivElement | null = null;
	let svgEl: SVGSVGElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	let corners: Record<CornerKey, Pt> = {
		tl: { x: 0.12, y: 0.08 },
		tr: { x: 0.88, y: 0.08 },
		bl: { x: 0.12, y: 0.92 },
		br: { x: 0.88, y: 0.92 }
	};

	let rowParams: RowParams[] = [];

	let cornerEls: Partial<Record<CornerKey, HTMLElement>> = {};
	let leftEls: HTMLElement[] = [];
	let rightEls: HTMLElement[] = [];
	let ctrlEls: HTMLElement[] = [];

	let showCurves = true;
	let showGrid = true;

	let rafDraw = 0;
	let rafEmit = 0;

	const EPS = 0.002;

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
		return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
	}
	function perp(a: Pt): Pt {
		return { x: -a.y, y: a.x };
	}

	function quadBezier(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
		const u = 1 - t;
		return {
			x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
			y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
		};
	}

	/* -------------------------------------------------
	   Row geometry
	------------------------------------------------- */

	function leftEdgeVec() {
		return sub(corners.bl, corners.tl);
	}
	function rightEdgeVec() {
		return sub(corners.br, corners.tr);
	}

	function rowEndpoints(r: number) {
		const p = rowParams[r];
		const L = lerp(corners.tl, corners.bl, p.leftT);
		const R = lerp(corners.tr, corners.br, p.rightT);
		return { L, R };
	}

	function rowControlPoint(r: number) {
		const p = rowParams[r];
		const { L, R } = rowEndpoints(r);

		const chord = sub(R, L);
		const Lc = len(chord);
		const b = Lc < 1e-9 ? { x: 1, y: 0 } : mul(chord, 1 / Lc);
		const n = perp(b);

		return add(add(L, mul(chord, p.s)), mul(n, p.k * Lc));
	}

	/* -------------------------------------------------
	   Even spacing along a quadratic curve (arc-length approx)
	------------------------------------------------- */

	function sampleEvenQuadratic(p0: Pt, p1: Pt, p2: Pt, count: number, steps = 80): Pt[] {
		if (count <= 1) return [p0];

		// sample polyline along t
		const ts: number[] = [];
		const pts: Pt[] = [];
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			ts.push(t);
			pts.push(quadBezier(p0, p1, p2, t));
		}

		// cumulative lengths
		const cum: number[] = [0];
		for (let i = 1; i < pts.length; i++) {
			const d = len(sub(pts[i], pts[i - 1]));
			cum.push(cum[i - 1] + d);
		}
		const total = cum[cum.length - 1];
		if (total < 1e-9) {
			// degenerate
			return Array.from({ length: count }, (_, i) => lerp(p0, p2, i / (count - 1)));
		}

		// invert by linear search (steps is small)
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
		for (let i = 0; i < count; i++) {
			const frac = count === 1 ? 0.5 : i / (count - 1);
			out.push(quadBezier(p0, p1, p2, tAtFrac(frac)));
		}
		return out;
	}

	function deriveMeshPoints(): Pt[] {
		const out: Pt[] = [];
		for (let r = 0; r < rows; r++) {
			const { L, R } = rowEndpoints(r);
			const C = rowControlPoint(r);
			const rowPts = sampleEvenQuadratic(L, C, R, cols);
			out.push(...rowPts);
		}
		return out;
	}

	function currentMesh(): DewarpMesh {
		return { rows, cols, points: deriveMeshPoints(), version: 1, method: 'bezier-rows-v1' };
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
	   OSD coordinate helpers
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
	   Overlays
	------------------------------------------------- */

	function createHandleEl(kind: 'corner' | 'end' | 'ctrl') {
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

		if (!(viewer as any).getOverlayById?.(el)) {
			viewer.addOverlay({ element: el, location: vp, placement: OpenSeadragon.Placement.CENTER });
		} else {
			viewer.updateOverlay(el, vp, OpenSeadragon.Placement.CENTER);
		}
	}

	function rebuildOverlays() {
		if (!viewer) return;

		viewer.clearOverlays();
		cornerEls = {};
		leftEls = [];
		rightEls = [];
		ctrlEls = [];

		// corners
		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = createHandleEl('corner');
			el.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'corner', corner: k, el })
			);
			cornerEls[k] = el;
			addOrUpdateOverlay(el, corners[k]);
		});

		// per-row handles
		for (let r = 0; r < rows; r++) {
			const elL = createHandleEl('end');
			elL.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'leftEnd', row: r, el: elL })
			);
			leftEls[r] = elL;

			const elR = createHandleEl('end');
			elR.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'rightEnd', row: r, el: elR })
			);
			rightEls[r] = elR;

			const elC = createHandleEl('ctrl');
			elC.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'ctrl', row: r, el: elC })
			);
			ctrlEls[r] = elC;

			const { L, R } = rowEndpoints(r);
			const C = rowControlPoint(r);

			addOrUpdateOverlay(elL, L);
			addOrUpdateOverlay(elR, R);
			addOrUpdateOverlay(elC, C);
		}

		scheduleRedraw();
		scheduleEmitMesh();
	}

	function refreshOverlayPositions() {
		if (!viewer) return;

		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = cornerEls[k];
			if (!el) return;
			addOrUpdateOverlay(el, corners[k]);
		});

		for (let r = 0; r < rows; r++) {
			const elL = leftEls[r];
			const elR = rightEls[r];
			const elC = ctrlEls[r];
			if (!elL || !elR || !elC) continue;

			const { L, R } = rowEndpoints(r);
			const C = rowControlPoint(r);

			addOrUpdateOverlay(elL, L);
			addOrUpdateOverlay(elR, R);
			addOrUpdateOverlay(elC, C);
		}
	}

	/* -------------------------------------------------
	   Dragging
	------------------------------------------------- */

	type DragTarget =
		| { kind: 'corner'; corner: CornerKey; el: HTMLElement }
		| { kind: 'leftEnd'; row: number; el: HTMLElement }
		| { kind: 'rightEnd'; row: number; el: HTMLElement }
		| { kind: 'ctrl'; row: number; el: HTMLElement };

	type DragState = {
		target: DragTarget;
		pointerId: number;
		navEnabledBefore: boolean;
	};

	let drag: DragState | null = null;

	function startDrag(e: PointerEvent, target: DragTarget) {
		if (!viewer) return;

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

	function clampMonotonicRowT(row: number, side: 'leftT' | 'rightT', t: number) {
		const prev = row > 0 ? rowParams[row - 1][side] : -Infinity;
		const next = row < rows - 1 ? rowParams[row + 1][side] : Infinity;
		return clamp(t, prev + EPS, next - EPS);
	}

	function projectToEdgeT(pt: Pt, a: Pt, b: Pt) {
		const ab = sub(b, a);
		const ap = sub(pt, a);
		const denom = dot(ab, ab);
		if (denom < 1e-9) return 0.5;
		return dot(ap, ab) / denom;
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

		const r = drag.target.row;

		if (drag.target.kind === 'leftEnd') {
			// constrain along left edge TL->BL
			const t = projectToEdgeT(pt, corners.tl, corners.bl);
			const clamped = clampMonotonicRowT(r, 'leftT', clamp(t, -0.1, 1.1));
			rowParams[r] = { ...rowParams[r], leftT: clamped };
			rowParams = [...rowParams];

			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		if (drag.target.kind === 'rightEnd') {
			// constrain along right edge TR->BR
			const t = projectToEdgeT(pt, corners.tr, corners.br);
			const clamped = clampMonotonicRowT(r, 'rightT', clamp(t, -0.1, 1.1));
			rowParams[r] = { ...rowParams[r], rightT: clamped };
			rowParams = [...rowParams];

			refreshOverlayPositions();
			scheduleRedraw();
			scheduleEmitMesh();
			return;
		}

		// ctrl handle: update (s,k) relative to chord
		const { L, R } = rowEndpoints(r);
		const chord = sub(R, L);
		const Lc = len(chord);
		const b = Lc < 1e-9 ? { x: 1, y: 0 } : mul(chord, 1 / Lc);
		const n = perp(b);

		const vH = sub(pt, L);

		const s = Lc < 1e-9 ? 0.5 : dot(vH, b) / Lc;
		const k = Lc < 1e-9 ? 0 : dot(vH, n) / Lc;

		rowParams[r] = { ...rowParams[r], s: clamp(s, -0.25, 1.25), k: clamp(k, -1, 1) };
		rowParams = [...rowParams];

		refreshOverlayPositions();
		scheduleRedraw();
		scheduleEmitMesh();
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
	   SVG overlay drawing
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

		// boundary quad
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

		if (showCurves) {
			for (let r = 0; r < rows; r++) {
				const { L, R } = rowEndpoints(r);
				const C = rowControlPoint(r);

				const a = normToPixel(L);
				const b = normToPixel(C);
				const c = normToPixel(R);

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('d', `M ${a.x} ${a.y} Q ${b.x} ${b.y} ${c.x} ${c.y}`);
				path.setAttribute('class', 'curve');
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

		rowParams = Array.from({ length: rows }, (_, r) => {
			const t = rows === 1 ? 0.5 : r / (rows - 1);
			return { leftT: t, rightT: t, s: 0.5, k: 0 };
		});

		rebuildOverlays();
	}

	function confirm() {
		onConfirm?.(currentMesh());
	}

	/* -------------------------------------------------
	   Lifecycle
	------------------------------------------------- */

	let ro: ResizeObserver | null = null;
	let currentUrl: string | null = null;

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

		rowParams = Array.from({ length: rows }, (_, r) => {
			const t = rows === 1 ? 0.5 : r / (rows - 1);
			return { leftT: t, rightT: t, s: 0.5, k: 0 };
		});

		currentUrl = imageUrl;
		viewer.addOnceHandler('open', () => rebuildOverlays());
		viewer.open({ type: 'image', url: imageUrl });
	});

	$: if (viewer && imageUrl && imageUrl !== currentUrl) {
		currentUrl = imageUrl;
		viewer.clearOverlays();
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

	:global(.curve) {
		fill: none;
		stroke: rgba(76, 159, 254, 0.7);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	:global(.grid) {
		stroke: rgba(255, 255, 255, 0.16);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	/* draggable handles (OSD overlays) */
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

	:global(.h.end) {
		width: 20px;
		height: 20px;
	}

	:global(.h.ctrl) {
		width: 22px;
		height: 22px;
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

	:global(.h.ctrl .dot) {
		width: 8px;
		height: 8px;
	}
</style>
