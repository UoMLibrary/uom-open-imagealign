<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	/* -------------------------------------------------
	   Types
	------------------------------------------------- */

	export type Pt = { x: number; y: number }; // normalised 0..1

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: Pt[];
		version: 1;
		method: 'bspline-grid';
	};

	/* -------------------------------------------------
	   Props
	------------------------------------------------- */

	export let imageUrl: string;
	export let existingMesh: DewarpMesh | null = null;

	export let rows = 8;
	export let cols = 6;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	// Svelte 5 callback prop
	export let onConfirm: (mesh: DewarpMesh) => void;

	/* -------------------------------------------------
	   Local State
	------------------------------------------------- */

	let hostEl: HTMLDivElement | null = null;
	let svgEl: SVGSVGElement | null = null;

	let viewer: OpenSeadragon.Viewer | null = null;
	let imgSize: { w: number; h: number } | null = null;

	let points: Pt[] = [];

	// OSD overlay elements for each control point
	let pointEls: HTMLElement[] = [];

	/* -------------------------------------------------
	   Helpers (mirrors AffineAlignTool style)
	------------------------------------------------- */

	function clamp01(v: number) {
		return Math.max(0, Math.min(1, v));
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

		return { x: clamp01(imgPoint.x / size.w), y: clamp01(imgPoint.y / size.h) };
	}

	function getMouseNavEnabled(v: OpenSeadragon.Viewer): boolean {
		const anyV: any = v as any;
		if (typeof anyV.isMouseNavEnabled === 'function') return anyV.isMouseNavEnabled();
		return true;
	}

	function createDefaultGrid(r: number, c: number): Pt[] {
		const pts: Pt[] = [];
		for (let row = 0; row < r; row++) {
			for (let col = 0; col < c; col++) {
				pts.push({
					x: c === 1 ? 0.5 : col / (c - 1),
					y: r === 1 ? 0.5 : row / (r - 1)
				});
			}
		}
		return pts;
	}

	/* -------------------------------------------------
	   OSD setup
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

	let currentUrl: string | null = null;

	function openImage(url: string) {
		if (!viewer) return;

		// Clear old overlays + state
		viewer.clearOverlays();
		pointEls = [];

		viewer.addOnceHandler('open', () => {
			imgSize = getContentSize(viewer!);

			// Initialise points (prefer existing mesh if compatible)
			if (
				existingMesh &&
				existingMesh.rows === rows &&
				existingMesh.cols === cols &&
				existingMesh.points?.length === rows * cols
			) {
				points = existingMesh.points.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
			} else {
				points = createDefaultGrid(rows, cols);
			}

			installPointOverlays();
			scheduleRedraw();
		});

		viewer.open({ type: 'image', url });
	}

	/* -------------------------------------------------
	   Point overlays
	------------------------------------------------- */

	function createPointEl(index: number) {
		const el = document.createElement('div');
		el.className = 'mp';
		el.innerHTML = `<div class="mp-ring"><div class="mp-dot"></div></div>`;
		el.style.zIndex = '30';

		el.addEventListener('pointerdown', (e) => startDrag(e as PointerEvent, index, el));
		el.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});

		return el;
	}

	function placeOverlayPoint(v: OpenSeadragon.Viewer, el: HTMLElement, pt: Pt) {
		const vp = normToViewportPoint(v, pt);
		if (!vp) return;
		v.addOverlay({ element: el, location: vp, placement: OpenSeadragon.Placement.CENTER });
	}

	function updateOverlayPoint(v: OpenSeadragon.Viewer, el: HTMLElement, pt: Pt) {
		const vp = normToViewportPoint(v, pt);
		if (!vp) return;
		v.updateOverlay(el, vp, OpenSeadragon.Placement.CENTER);
	}

	function installPointOverlays() {
		if (!viewer) return;

		points.forEach((pt, i) => {
			const el = createPointEl(i);
			pointEls[i] = el;
			placeOverlayPoint(viewer!, el, pt);
		});
	}

	function refreshPointOverlays() {
		if (!viewer) return;
		points.forEach((pt, i) => {
			const el = pointEls[i];
			if (!el) return;
			updateOverlayPoint(viewer!, el, pt);
		});
	}

	/* -------------------------------------------------
	   Drag
	------------------------------------------------- */

	type DragState = {
		index: number;
		el: HTMLElement;
		pointerId: number;
		temp: Pt | null;
		navEnabledBefore: boolean;
	};

	let drag: DragState | null = null;

	function startDrag(e: PointerEvent, index: number, el: HTMLElement) {
		if (!viewer) return;

		e.preventDefault();
		e.stopPropagation();

		el.setPointerCapture(e.pointerId);
		el.classList.add('dragging');

		const navEnabledBefore = getMouseNavEnabled(viewer);
		viewer.setMouseNavEnabled(false);

		drag = { index, el, pointerId: e.pointerId, temp: null, navEnabledBefore };

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

		drag.temp = pt;

		// Live update overlay + grid lines
		updateOverlayPoint(viewer, drag.el, pt);
		scheduleRedrawWithTemp(drag.index, pt);
	}

	function onDragEnd(e: PointerEvent) {
		if (!viewer || !drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const { index, temp, navEnabledBefore } = drag;
		stopDrag();
		viewer.setMouseNavEnabled(navEnabledBefore);

		if (!temp) {
			scheduleRedraw();
			return;
		}

		const next = [...points];
		next[index] = temp;
		points = next;

		refreshPointOverlays();
		scheduleRedraw();
	}

	function stopDrag() {
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
		window.removeEventListener('pointercancel', onDragEnd);

		if (drag?.el) drag.el.classList.remove('dragging');
		drag = null;
	}

	/* -------------------------------------------------
	   Grid drawing (SVG overlay)
	------------------------------------------------- */

	let raf = 0;
	let tempOverride: { index: number; pt: Pt } | null = null;

	function scheduleRedraw() {
		tempOverride = null;
		scheduleRedrawInternal();
	}

	function scheduleRedrawWithTemp(index: number, pt: Pt) {
		tempOverride = { index, pt };
		scheduleRedrawInternal();
	}

	function scheduleRedrawInternal() {
		if (!viewer || !svgEl) return;
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			redrawGrid();
		});
	}

	function redrawGrid() {
		if (!viewer || !svgEl) return;

		const rect = viewer.container.getBoundingClientRect();
		const w = Math.max(1, Math.floor(rect.width));
		const h = Math.max(1, Math.floor(rect.height));

		svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

		// Points to draw against (optionally override one during drag for smoothness)
		const drawPts = points.map((p) => ({ ...p }));
		if (tempOverride) drawPts[tempOverride.index] = tempOverride.pt;

		// Convert each normalised point to viewer-element pixel coords
		const pxPts = drawPts.map((pt) => {
			const vp = normToViewportPoint(viewer!, pt);
			if (!vp) return { x: -9999, y: -9999 };
			const px = viewer!.viewport.pixelFromPoint(vp, true);
			return { x: px.x, y: px.y };
		});

		// Ensure line elements exist
		const needed = rows * (cols - 1) + cols * (rows - 1);
		let g = svgEl.querySelector('g[data-grid="true"]') as SVGGElement | null;
		if (!g) {
			g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.dataset.grid = 'true';
			svgEl.appendChild(g);
		}

		// Create/remove to match
		const existing = Array.from(g.querySelectorAll('line'));
		while (existing.length < needed) {
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('class', 'grid-line');
			g.appendChild(line);
			existing.push(line);
		}
		while (existing.length > needed) {
			const line = existing.pop();
			line?.remove();
		}

		let k = 0;

		// Horizontal lines
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols - 1; c++) {
				const i = r * cols + c;
				const j = r * cols + c + 1;
				const a = pxPts[i];
				const b = pxPts[j];
				const line = existing[k++] as SVGLineElement;
				line.setAttribute('x1', String(a.x));
				line.setAttribute('y1', String(a.y));
				line.setAttribute('x2', String(b.x));
				line.setAttribute('y2', String(b.y));
			}
		}

		// Vertical lines
		for (let c = 0; c < cols; c++) {
			for (let r = 0; r < rows - 1; r++) {
				const i = r * cols + c;
				const j = (r + 1) * cols + c;
				const a = pxPts[i];
				const b = pxPts[j];
				const line = existing[k++] as SVGLineElement;
				line.setAttribute('x1', String(a.x));
				line.setAttribute('y1', String(a.y));
				line.setAttribute('x2', String(b.x));
				line.setAttribute('y2', String(b.y));
			}
		}
	}

	/* -------------------------------------------------
	   Actions
	------------------------------------------------- */

	function resetMesh() {
		points = createDefaultGrid(rows, cols);
		refreshPointOverlays();
		scheduleRedraw();
	}

	function confirmMesh() {
		const mesh: DewarpMesh = {
			rows,
			cols,
			points,
			version: 1,
			method: 'bspline-grid'
		};
		onConfirm?.(mesh);
	}

	/* -------------------------------------------------
	   Lifecycle
	------------------------------------------------- */

	let ro: ResizeObserver | null = null;

	onMount(() => {
		if (!hostEl) return;

		viewer = makeViewer(hostEl);

		// SVG overlay (grid lines)
		svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgEl.classList.add('grid-overlay');
		hostEl.appendChild(svgEl);

		// Redraw when viewport changes
		const schedule = () => scheduleRedrawInternal();
		viewer.addHandler('animation', schedule);
		viewer.addHandler('zoom', schedule);
		viewer.addHandler('pan', schedule);
		viewer.addHandler('resize', schedule);

		// ResizeObserver helps when layout changes
		ro = new ResizeObserver(() => scheduleRedrawInternal());
		ro.observe(viewer.container);

		currentUrl = imageUrl;
		openImage(imageUrl);
	});

	$: if (viewer && imageUrl && imageUrl !== currentUrl) {
		currentUrl = imageUrl;
		openImage(imageUrl);
	}

	onDestroy(() => {
		stopDrag();
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
		<button class="btn" on:click={resetMesh}>Reset mesh</button>
		<button class="btn" on:click={confirmMesh}>Confirm</button>
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
	}

	.btn {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 8px;
		padding: 0.45rem 0.7rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.btn:active {
		transform: translateY(1px);
	}

	/* SVG overlay for grid lines */
	:global(svg.grid-overlay) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 10;
		pointer-events: none;
	}

	:global(.grid-line) {
		stroke: rgba(255, 255, 255, 0.45);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	/* Mesh control point element (OSD overlay) */
	:global(.mp) {
		width: 18px;
		height: 18px;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		cursor: grab;
		touch-action: none;
	}

	:global(.mp.dragging) {
		cursor: grabbing;
	}

	:global(.mp-ring) {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		border: 2px solid rgba(255, 255, 255, 0.9);
		display: grid;
		place-items: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		background: rgba(0, 0, 0, 0.12);
	}

	:global(.mp-dot) {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: #4c9ffe;
	}
</style>
