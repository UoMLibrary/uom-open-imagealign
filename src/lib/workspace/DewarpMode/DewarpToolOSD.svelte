<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	/* -------------------------------------------------
	   Types
	------------------------------------------------- */

	export type Pt = { x: number; y: number }; // normalised (but we allow slight overshoot)
	type UV = { u: number; v: number };

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: Pt[];
		version: 1;
		method: 'bspline-grid';
	};

	type Mat3 = [number, number, number, number, number, number, number, number, number]; // row-major

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

	let points: Pt[] = [];
	let uvs: UV[] = []; // parameter space positions (stick to corners)
	let pointEls: HTMLElement[] = [];

	const OVERSHOOT_MIN = -0.25;
	const OVERSHOOT_MAX = 1.25;

	/* -------------------------------------------------
	   Basic helpers
	------------------------------------------------- */

	function clamp(v: number, a: number, b: number) {
		return Math.max(a, Math.min(b, v));
	}

	function clampPt(p: Pt): Pt {
		return {
			x: clamp(p.x, OVERSHOOT_MIN, OVERSHOOT_MAX),
			y: clamp(p.y, OVERSHOOT_MIN, OVERSHOOT_MAX)
		};
	}

	function getMouseNavEnabled(v: OpenSeadragon.Viewer): boolean {
		const anyV: any = v as any;
		if (typeof anyV.isMouseNavEnabled === 'function') return anyV.isMouseNavEnabled();
		return true;
	}

	function createDefaultUVGrid(r: number, c: number): UV[] {
		const out: UV[] = [];
		for (let row = 0; row < r; row++) {
			for (let col = 0; col < c; col++) {
				out.push({
					u: c === 1 ? 0.5 : col / (c - 1),
					v: r === 1 ? 0.5 : row / (r - 1)
				});
			}
		}
		return out;
	}

	function cornerIndexSet(r: number, c: number) {
		const last = r * c - 1;
		return new Set([0, c - 1, (r - 1) * c, last]);
	}

	function getCornersFromPoints(pts: Pt[], r: number, c: number) {
		const tl = pts[0];
		const tr = pts[c - 1];
		const bl = pts[(r - 1) * c];
		const br = pts[r * c - 1];
		return { tl, tr, bl, br };
	}

	/* -------------------------------------------------
	   Homography math (unit square <-> quad)
	   Maps (u,v) in [0..1]^2 to quad corners (x,y)
	------------------------------------------------- */

	function solveLinear8x8(A: number[][], b: number[]): number[] | null {
		// Gaussian elimination with partial pivoting
		const n = 8;
		const M = A.map((row, i) => [...row, b[i]]);

		for (let col = 0; col < n; col++) {
			// pivot
			let pivot = col;
			for (let row = col + 1; row < n; row++) {
				if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
			}
			if (Math.abs(M[pivot][col]) < 1e-12) return null;
			if (pivot !== col) [M[pivot], M[col]] = [M[col], M[pivot]];

			// normalize pivot row
			const div = M[col][col];
			for (let k = col; k <= n; k++) M[col][k] /= div;

			// eliminate
			for (let row = 0; row < n; row++) {
				if (row === col) continue;
				const factor = M[row][col];
				if (Math.abs(factor) < 1e-12) continue;
				for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
			}
		}

		return M.map((row) => row[n]);
	}

	function homographyFromUnitSquareToQuad(tl: Pt, tr: Pt, bl: Pt, br: Pt): Mat3 | null {
		// Correspondences:
		// (0,0)->tl, (1,0)->tr, (0,1)->bl, (1,1)->br
		const src: UV[] = [
			{ u: 0, v: 0 },
			{ u: 1, v: 0 },
			{ u: 0, v: 1 },
			{ u: 1, v: 1 }
		];
		const dst: Pt[] = [tl, tr, bl, br];

		// Unknowns: [h11,h12,h13,h21,h22,h23,h31,h32] with h33=1
		const A: number[][] = [];
		const b: number[] = [];

		for (let i = 0; i < 4; i++) {
			const { u, v } = src[i];
			const { x, y } = dst[i];

			// x equation
			A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
			b.push(x);

			// y equation
			A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
			b.push(y);
		}

		const sol = solveLinear8x8(A, b);
		if (!sol) return null;

		const [h11, h12, h13, h21, h22, h23, h31, h32] = sol;
		return [h11, h12, h13, h21, h22, h23, h31, h32, 1];
	}

	function invertMat3(m: Mat3): Mat3 | null {
		const [a, b, c, d, e, f, g, h, i] = m;

		const A = e * i - f * h;
		const B = -(d * i - f * g);
		const C = d * h - e * g;

		const D = -(b * i - c * h);
		const E = a * i - c * g;
		const F = -(a * h - b * g);

		const G = b * f - c * e;
		const H = -(a * f - c * d);
		const I = a * e - b * d;

		const det = a * A + b * B + c * C;
		if (Math.abs(det) < 1e-12) return null;

		const invDet = 1 / det;
		return [
			A * invDet,
			D * invDet,
			G * invDet,
			B * invDet,
			E * invDet,
			H * invDet,
			C * invDet,
			F * invDet,
			I * invDet
		];
	}

	function applyHomography(m: Mat3, u: number, v: number): Pt {
		const x = m[0] * u + m[1] * v + m[2];
		const y = m[3] * u + m[4] * v + m[5];
		const w = m[6] * u + m[7] * v + m[8];
		if (Math.abs(w) < 1e-12) return { x: x, y: y };
		return { x: x / w, y: y / w };
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

		return clampPt({ x: imgPoint.x / size.w, y: imgPoint.y / size.h });
	}

	/* -------------------------------------------------
	   Viewer setup
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

		viewer.clearOverlays();
		pointEls = [];

		viewer.addOnceHandler('open', () => {
			// initialise UVs always
			uvs = createDefaultUVGrid(rows, cols);

			// initialise points
			if (
				existingMesh &&
				existingMesh.rows === rows &&
				existingMesh.cols === cols &&
				existingMesh.points?.length === rows * cols
			) {
				points = existingMesh.points.map((p) => clampPt({ x: p.x, y: p.y }));

				// derive UVs from existing points under current corners (so later corner moves "carry" the edits)
				const { tl, tr, bl, br } = getCornersFromPoints(points, rows, cols);
				const H = homographyFromUnitSquareToQuad(tl, tr, bl, br);
				const invH = H ? invertMat3(H) : null;

				if (invH) {
					const corners = cornerIndexSet(rows, cols);
					uvs = uvs.map((uv, idx) => {
						if (corners.has(idx)) return uv; // keep exact corner UVs
						const p = points[idx];
						const uv2 = applyHomography(invH, p.x, p.y);
						return { u: uv2.x, v: uv2.y };
					});
				}
			} else {
				// default square corners => identity mapping
				points = uvs.map((uv) => ({ x: uv.u, y: uv.v }));
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

		if (cornerIndexSet(rows, cols).has(index)) el.classList.add('corner');

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

	function refreshPointOverlays(usePts: Pt[] = points) {
		if (!viewer) return;
		usePts.forEach((pt, i) => {
			const el = pointEls[i];
			if (!el) return;
			updateOverlayPoint(viewer!, el, pt);
		});
	}

	/* -------------------------------------------------
	   Drag behaviour
	   - Non-corner: update its UV by inverse homography (so it "sticks" to the quad)
	   - Corner: recompute all points from UVs using new quad homography
	------------------------------------------------- */

	type DragState =
		| {
				mode: 'single';
				index: number;
				el: HTMLElement;
				pointerId: number;
				navEnabledBefore: boolean;
				tempPt: Pt | null;
		  }
		| {
				mode: 'corner';
				index: number;
				el: HTMLElement;
				pointerId: number;
				navEnabledBefore: boolean;
				baseCorners: { tl: Pt; tr: Pt; bl: Pt; br: Pt };
				tempPoints: Pt[] | null;
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

		const corners = cornerIndexSet(rows, cols);
		if (corners.has(index)) {
			drag = {
				mode: 'corner',
				index,
				el,
				pointerId: e.pointerId,
				navEnabledBefore,
				baseCorners: getCornersFromPoints(points, rows, cols),
				tempPoints: null
			};
		} else {
			drag = {
				mode: 'single',
				index,
				el,
				pointerId: e.pointerId,
				navEnabledBefore,
				tempPt: null
			};
		}

		window.addEventListener('pointermove', onDragMove, { passive: false });
		window.addEventListener('pointerup', onDragEnd, { passive: false });
		window.addEventListener('pointercancel', onDragEnd, { passive: false });
	}

	function computePointsFromCorners(corners: { tl: Pt; tr: Pt; bl: Pt; br: Pt }): Pt[] | null {
		const H = homographyFromUnitSquareToQuad(corners.tl, corners.tr, corners.bl, corners.br);
		if (!H) return null;
		return uvs.map((uv) => clampPt(applyHomography(H, uv.u, uv.v)));
	}

	function updateUVFromPoint(index: number, newPt: Pt) {
		// derive uv for a moved interior point using inverse homography of current corners
		const corners = getCornersFromPoints(points, rows, cols);
		const H = homographyFromUnitSquareToQuad(corners.tl, corners.tr, corners.bl, corners.br);
		const invH = H ? invertMat3(H) : null;
		if (!invH) return;

		const uv2 = applyHomography(invH, newPt.x, newPt.y);
		uvs[index] = { u: uv2.x, v: uv2.y };
		uvs = [...uvs];
	}

	function onDragMove(e: PointerEvent) {
		if (!viewer || !drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const pt = clientToNorm(viewer, e.clientX, e.clientY);
		if (!pt) return;

		if (drag.mode === 'single') {
			drag.tempPt = pt;

			// live update just this point
			updateOverlayPoint(viewer, drag.el, pt);
			scheduleRedrawWithTempSingle(drag.index, pt);
			return;
		}

		// corner move => create new corner set (NOT axis-locked)
		const c = { ...drag.baseCorners };

		const tlIdx = 0;
		const trIdx = cols - 1;
		const blIdx = (rows - 1) * cols;
		const brIdx = rows * cols - 1;

		if (drag.index === tlIdx) c.tl = pt;
		else if (drag.index === trIdx) c.tr = pt;
		else if (drag.index === blIdx) c.bl = pt;
		else if (drag.index === brIdx) c.br = pt;

		const tempPoints = computePointsFromCorners(c);
		if (!tempPoints) return;

		drag.tempPoints = tempPoints;

		// live update all overlays + grid
		refreshPointOverlays(tempPoints);
		scheduleRedrawWithTempAll(tempPoints);
	}

	function onDragEnd(e: PointerEvent) {
		if (!viewer || !drag) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const navEnabledBefore = drag.navEnabledBefore;

		if (drag.mode === 'single') {
			const { index, tempPt } = drag;
			stopDrag();
			viewer.setMouseNavEnabled(navEnabledBefore);

			if (tempPt) {
				// commit point position
				const next = [...points];
				next[index] = tempPt;
				points = next;

				// update its UV so it "sticks" when corners move later
				updateUVFromPoint(index, tempPt);

				refreshPointOverlays();
			}

			scheduleRedraw();
			return;
		}

		// corner commit
		const committed = drag.tempPoints;
		stopDrag();
		viewer.setMouseNavEnabled(navEnabledBefore);

		if (committed) {
			points = committed;
			refreshPointOverlays();
		}

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
	type TempOverride = null | { kind: 'single'; index: number; pt: Pt } | { kind: 'all'; pts: Pt[] };
	let tempOverride: TempOverride = null;

	function scheduleRedraw() {
		tempOverride = null;
		scheduleRedrawInternal();
	}

	function scheduleRedrawWithTempSingle(index: number, pt: Pt) {
		tempOverride = { kind: 'single', index, pt };
		scheduleRedrawInternal();
	}

	function scheduleRedrawWithTempAll(pts: Pt[]) {
		tempOverride = { kind: 'all', pts };
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
		svgEl.setAttribute('preserveAspectRatio', 'none');

		let drawPts = points.map((p) => ({ ...p }));

		if (tempOverride?.kind === 'single') {
			drawPts[tempOverride.index] = tempOverride.pt;
		} else if (tempOverride?.kind === 'all') {
			if (tempOverride.pts.length === drawPts.length) drawPts = tempOverride.pts;
		}

		const pxPts = drawPts.map((pt) => {
			const vp = normToViewportPoint(viewer!, pt);
			if (!vp) return { x: -9999, y: -9999 };
			const px = viewer!.viewport.pixelFromPoint(vp, true);
			return { x: px.x, y: px.y };
		});

		const needed = rows * (cols - 1) + cols * (rows - 1);

		let g = svgEl.querySelector('g[data-grid="true"]') as SVGGElement | null;
		if (!g) {
			g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.dataset.grid = 'true';
			svgEl.appendChild(g);
		}

		const existing = Array.from(g.querySelectorAll('line'));
		while (existing.length < needed) {
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('class', 'grid-line');
			g.appendChild(line);
			existing.push(line);
		}
		while (existing.length > needed) {
			existing.pop()?.remove();
		}

		let k = 0;

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
		uvs = createDefaultUVGrid(rows, cols);
		points = uvs.map((uv) => ({ x: uv.u, y: uv.v }));
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

		// SVG overlay inside the OSD container so coords match exactly
		svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgEl.classList.add('grid-overlay');
		viewer.container.appendChild(svgEl);

		const schedule = () => scheduleRedrawInternal();
		viewer.addHandler('animation', schedule);
		viewer.addHandler('zoom', schedule);
		viewer.addHandler('pan', schedule);
		viewer.addHandler('resize', schedule);

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

	/* SVG grid overlay */
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

	/* Mesh control points (OSD overlays)
	   IMPORTANT: no translate(-50%,-50%) here because Placement.CENTER already centers */
	:global(.mp) {
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		cursor: grab;
		touch-action: none;
	}

	:global(.mp.dragging) {
		cursor: grabbing;
	}

	:global(.mp.corner) {
		width: 26px;
		height: 26px;
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

	:global(.mp.corner .mp-ring) {
		width: 22px;
		height: 22px;
	}

	:global(.mp-dot) {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: #4c9ffe;
	}

	:global(.mp.corner .mp-dot) {
		width: 8px;
		height: 8px;
	}
</style>
