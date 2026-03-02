<!-- OsdPointPanel.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	export type Pt = { x: number; y: number };

	/* -------------------------------------------------
	   Props
	------------------------------------------------- */

	export let title = '';
	export let url: string | null = null;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	// Points for THIS panel only (either source points or target points)
	export let points: Pt[] = [];

	// Which index is "active" (for highlight)
	export let activeIndex: number | null = null;

	// Enable click-to-add on this panel
	export let allowAdd = false;

	// If true, require Shift+click to add
	export let requireShiftToAdd = true;

	// Prevent adding beyond this number of points
	export let maxPoints = 120;

	// Bindable viewer so parent can sync zoom/home etc.
	export let viewer: OpenSeadragon.Viewer | null = null;

	// Optional: let parent know image size (px) when opened
	export let onOpen: ((size: { w: number; h: number }) => void) | undefined = undefined;

	// Callbacks (Svelte 5-style: callback props)
	export let onAdd: ((pt: Pt) => void) | undefined = undefined;
	export let onSelect: ((index: number) => void) | undefined = undefined;
	export let onMove: ((index: number, pt: Pt) => void) | undefined = undefined;

	/* -------------------------------------------------
	   Local state
	------------------------------------------------- */

	let hostEl: HTMLDivElement | null = null;
	let imgSize: { w: number; h: number } | null = null;

	function clamp01(v: number) {
		return Math.max(0, Math.min(1, v));
	}

	function isMarkerEventFromOriginalEvent(originalEvent: any) {
		const el = (originalEvent?.target as HTMLElement | null) ?? null;
		return !!el?.closest?.('.kp');
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

	function openImage(v: OpenSeadragon.Viewer, u: string) {
		v.addOnceHandler('open', () => {
			imgSize = getContentSize(v);
			if (imgSize) onOpen?.(imgSize);
			refreshOverlays();
		});
		v.open({ type: 'image', url: u });
	}

	/* -------------------------------------------------
	   Markers + drag
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

	function getMouseNavEnabled(v: OpenSeadragon.Viewer): boolean {
		const anyV: any = v as any;
		if (typeof anyV.isMouseNavEnabled === 'function') return anyV.isMouseNavEnabled();
		return true;
	}

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
		if (!drag || !viewer) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const pt = clientToNorm(viewer, e.clientX, e.clientY);
		if (!pt) return;

		drag.temp = pt;
		updateOverlayPoint(viewer, drag.el, pt);
	}

	function onDragEnd(e: PointerEvent) {
		if (!drag || !viewer) return;
		if (e.pointerId !== drag.pointerId) return;

		e.preventDefault();

		const { index, temp, navEnabledBefore } = drag;
		stopDrag();

		viewer.setMouseNavEnabled(navEnabledBefore);

		if (!temp) {
			refreshOverlays();
			return;
		}

		onMove?.(index, temp);
	}

	function stopDrag() {
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
		window.removeEventListener('pointercancel', onDragEnd);

		if (drag?.el) drag.el.classList.remove('dragging');
		drag = null;
	}

	function refreshOverlays() {
		if (!viewer) return;
		if (drag) return;

		// If image not open yet, skip
		if (!viewer.world?.getItemAt?.(0)) return;

		viewer.clearOverlays();

		for (let i = 0; i < points.length; i++) {
			const pt = points[i];
			if (!pt) continue;

			const isActive = i === activeIndex;
			const el = createMarkerEl(String(i + 1), isActive);

			el.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				onSelect?.(i);
			});

			el.addEventListener('pointerdown', (e) => startDrag(e as PointerEvent, i, el));

			placeOverlayPoint(viewer, el, pt);
		}
	}

	/* -------------------------------------------------
	   Click-to-add handler (optional)
	------------------------------------------------- */

	function onCanvasClick(ev: any) {
		if (!viewer) return;
		if (!allowAdd) return;
		if (!ev?.quick) return;

		const oe = ev.originalEvent as MouseEvent;
		if (isMarkerEventFromOriginalEvent(oe)) return;
		if (requireShiftToAdd && !oe.shiftKey) return;
		if (points.length >= maxPoints) return;

		const vpPoint = viewer.viewport.pointFromPixel(ev.position, true);
		const imgPoint = viewer.viewport.viewportToImageCoordinates(vpPoint);
		const size = getContentSize(viewer);
		if (!size) return;

		const pt: Pt = { x: clamp01(imgPoint.x / size.w), y: clamp01(imgPoint.y / size.h) };
		onAdd?.(pt);
	}

	/* -------------------------------------------------
	   Lifecycle
	------------------------------------------------- */

	onMount(() => {
		if (!hostEl) return;

		viewer = makeViewer(hostEl);
		viewer.addHandler('canvas-click', onCanvasClick);

		if (url) openImage(viewer, url);
	});

	onDestroy(() => {
		stopDrag();
		if (viewer) {
			try {
				viewer.removeHandler('canvas-click', onCanvasClick);
			} catch {
				// ignore
			}
			viewer.destroy();
		}
		viewer = null;
	});

	// Open when URL changes
	$: if (viewer && url) openImage(viewer, url);

	// Refresh overlays when points / activeIndex change (and viewer exists)
	$: if (viewer) {
		// touch these so Svelte tracks them as dependencies
		points;
		activeIndex;
		refreshOverlays();
	}
</script>

<section class="panel">
	{#if title}
		<header>{title}</header>
	{/if}
	<div class="osd" bind:this={hostEl} />
</section>

<style>
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

	.osd {
		flex: 1;
		min-height: 0;
		background: rgba(255, 255, 255, 0.65);
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
