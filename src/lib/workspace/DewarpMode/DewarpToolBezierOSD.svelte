<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	export type Pt = { x: number; y: number }; // normalised (allow slight overshoot)

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: Pt[];
		version: 1;
		method: 'bezier-rows';
	};

	type CornerKey = 'tl' | 'tr' | 'bl' | 'br';
	type RowParam = { s: number; k: number };

	export let imageUrl: string;

	export let rows = 10; // rows of curves (and mesh rows)
	export let cols = 8; // mesh cols (derived)

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	// Svelte 5 callback props
	export let onConfirm: (mesh: DewarpMesh) => void;
	export let onMeshChange: ((mesh: DewarpMesh) => void) | undefined;

	let hostEl: HTMLDivElement | null = null;
	let svgEl: SVGSVGElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	// corners (normalised)
	let corners: Record<CornerKey, Pt> = {
		tl: { x: 0.12, y: 0.08 },
		tr: { x: 0.88, y: 0.08 },
		bl: { x: 0.12, y: 0.92 },
		br: { x: 0.88, y: 0.92 }
	};

	// one control point per row, stored as (s along chord, k perpendicular/length)
	let rowParams: RowParam[] = [];

	// OSD overlay elements
	let cornerEls: Partial<Record<CornerKey, HTMLElement>> = {};
	let rowEls: HTMLElement[] = [];

	// render toggles
	let showCurves = true;
	let showGrid = false;

	// allow slight overshoot so you can pull curves beyond the quad edges a bit
	const OVERSHOOT_MIN = -0.25;
	const OVERSHOOT_MAX = 1.25;

	function clamp(v: number, a: number, b: number) {
		return Math.max(a, Math.min(b, v));
	}
	function clampPt(p: Pt): Pt {
		return {
			x: clamp(p.x, OVERSHOOT_MIN, OVERSHOOT_MAX),
			y: clamp(p.y, OVERSHOOT_MIN, OVERSHOOT_MAX)
		};
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
		return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
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
	   Row geometry from corners + rowParams
	------------------------------------------------- */

	function rowEndpoints(v: number) {
		const L = lerp(corners.tl, corners.bl, v);
		const R = lerp(corners.tr, corners.br, v);
		return { L, R };
	}

	function rowControlPoint(v: number, param: RowParam) {
		const { L, R } = rowEndpoints(v);
		const B = sub(R, L);
		const Lb = len(B);
		const b = Lb < 1e-9 ? { x: 1, y: 0 } : mul(B, 1 / Lb);
		const n = perp(b);

		const s = param.s;
		const k = param.k;

		// C = L + s*B + k*|B|*n
		return add(add(L, mul(B, s)), mul(n, k * Lb));
	}

	function deriveMeshPoints(): Pt[] {
		const pts: Pt[] = [];

		for (let r = 0; r < rows; r++) {
			const v = rows === 1 ? 0.5 : r / (rows - 1);
			const { L, R } = rowEndpoints(v);
			const C = rowControlPoint(v, rowParams[r]);

			for (let c = 0; c < cols; c++) {
				const t = cols === 1 ? 0.5 : c / (cols - 1);
				pts.push(clampPt(quadBezier(L, C, R, t)));
			}
		}

		return pts;
	}

	function emitMeshChange() {
		const mesh: DewarpMesh = {
			rows,
			cols,
			points: deriveMeshPoints(),
			version: 1,
			method: 'bezier-rows'
		};
		onMeshChange?.(mesh);
	}

	/* -------------------------------------------------
	   OSD coordinate helpers
	------------------------------------------------- */

	function getMouseNavEnabled(v: OpenSeadragon.Viewer): boolean {
		const anyV: any = v as any;
		if (typeof anyV.isMouseNavEnabled === 'function') return anyV.isMouseNavEnabled();
		return true;
	}

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

		return clampPt({ x: imgPoint.x / size.w, y: imgPoint.y / size.h });
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

	/* -------------------------------------------------
	   Overlays
	------------------------------------------------- */

	function createHandleEl(kind: 'corner' | 'row') {
		const el = document.createElement('div');
		el.className = kind === 'corner' ? 'h corner' : 'h row';
		el.innerHTML = `<div class="ring"><div class="dot"></div></div>`;
		el.style.zIndex = '30';
		return el;
	}

	function addOrUpdateOverlay(el: HTMLElement, pt: Pt) {
		if (!viewer) return;
		const vp = normToViewportPoint(viewer, pt);
		if (!vp) return;

		if (!viewer.getOverlayById(el)) {
			viewer.addOverlay({ element: el, location: vp, placement: OpenSeadragon.Placement.CENTER });
		} else {
			viewer.updateOverlay(el, vp, OpenSeadragon.Placement.CENTER);
		}
	}

	function rebuildOverlays() {
		if (!viewer) return;

		viewer.clearOverlays();
		cornerEls = {};
		rowEls = [];

		// corners
		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = createHandleEl('corner');
			el.dataset.kind = 'corner';
			el.dataset.corner = k;
			el.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'corner', corner: k, el })
			);
			cornerEls[k] = el;
			addOrUpdateOverlay(el, corners[k]);
		});

		// row controls
		for (let r = 0; r < rows; r++) {
			const el = createHandleEl('row');
			el.dataset.kind = 'row';
			el.dataset.row = String(r);
			el.addEventListener('pointerdown', (e) =>
				startDrag(e as PointerEvent, { kind: 'row', row: r, el })
			);
			rowEls[r] = el;

			const v = rows === 1 ? 0.5 : r / (rows - 1);
			const C = rowControlPoint(v, rowParams[r]);
			addOrUpdateOverlay(el, C);
		}

		scheduleRedraw();
		emitMeshChange();
	}

	function refreshOverlayPositions() {
		if (!viewer) return;

		(['tl', 'tr', 'bl', 'br'] as CornerKey[]).forEach((k) => {
			const el = cornerEls[k];
			if (!el) return;
			addOrUpdateOverlay(el, corners[k]);
		});

		for (let r = 0; r < rows; r++) {
			const el = rowEls[r];
			if (!el) continue;

			const v = rows === 1 ? 0.5 : r / (rows - 1);
			const C = rowControlPoint(v, rowParams[r]);
			addOrUpdateOverlay(el, C);
		}
	}

	/* -------------------------------------------------
	   Dragging
	------------------------------------------------- */

	type DragTarget =
		| { kind: 'corner'; corner: CornerKey; el: HTMLElement }
		| { kind: 'row'; row: number; el: HTMLElement };

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
			emitMeshChange();
			return;
		}

		// row handle: update (s,k) from pt relative to current row chord
		const r = drag.target.row;
		const v = rows === 1 ? 0.5 : r / (rows - 1);
		const { L, R } = rowEndpoints(v);

		const B = sub(R, L);
		const Lb = len(B);
		const b = Lb < 1e-9 ? { x: 1, y: 0 } : mul(B, 1 / Lb);
		const n = perp(b);

		const vH = sub(pt, L);

		const s = Lb < 1e-9 ? 0.5 : dot(vH, b) / Lb; // along-chord
		const k = Lb < 1e-9 ? 0 : dot(vH, n) / Lb; // perp fraction of length

		// allow overshoot for s/k so you can pull handles beyond edges if needed
		rowParams[r] = { s: clamp(s, -0.25, 1.25), k: clamp(k, -0.75, 0.75) };
		rowParams = [...rowParams];

		const C = rowControlPoint(v, rowParams[r]);
		addOrUpdateOverlay(drag.target.el, C);

		scheduleRedraw();
		emitMeshChange();
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

	let raf = 0;

	function scheduleRedraw() {
		if (!viewer || !svgEl) return;
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
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

		// clear
		while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

		// border quad
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

		// curves
		if (showCurves) {
			for (let r = 0; r < rows; r++) {
				const v = rows === 1 ? 0.5 : r / (rows - 1);
				const { L, R } = rowEndpoints(v);
				const C = rowControlPoint(v, rowParams[r]);

				const a = normToPixel(L);
				const b = normToPixel(C);
				const c = normToPixel(R);

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('d', `M ${a.x} ${a.y} Q ${b.x} ${b.y} ${c.x} ${c.y}`);
				path.setAttribute('class', 'curve');
				svgEl.appendChild(path);
			}
		}

		// derived grid (optional)
		if (showGrid) {
			const pts = deriveMeshPoints();
			if (pts.length === rows * cols) {
				const pxPts = pts.map(normToPixel);

				// horizontal
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

				// vertical
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

	function resetAll() {
		corners = {
			tl: { x: 0.12, y: 0.08 },
			tr: { x: 0.88, y: 0.08 },
			bl: { x: 0.12, y: 0.92 },
			br: { x: 0.88, y: 0.92 }
		};

		rowParams = Array.from({ length: rows }, () => ({ s: 0.5, k: 0 }));
		rebuildOverlays();
	}

	function confirm() {
		const mesh: DewarpMesh = {
			rows,
			cols,
			points: deriveMeshPoints(),
			version: 1,
			method: 'bezier-rows'
		};
		onConfirm?.(mesh);
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

		rowParams = Array.from({ length: rows }, () => ({ s: 0.5, k: 0 }));

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
		if (raf) cancelAnimationFrame(raf);
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
		<button class="btn" on:click={resetAll}>Reset</button>
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
		stroke: rgba(76, 159, 254, 0.65);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	:global(.grid) {
		stroke: rgba(255, 255, 255, 0.18);
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

	:global(.h.row) {
		width: 20px;
		height: 20px;
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

	:global(.h.corner .dot) {
		width: 8px;
		height: 8px;
	}
</style>
