<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	type Pt = { x: number; y: number }; // normalised 0..1

	export let imageUrl: string | null = null;

	// Optional: keep result zoom matched to source/target zoom
	export let zoom: number | null = null;

	// Optional: pan to this point (normalised in result image space)
	export let focus: Pt | null = null;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	let el: HTMLDivElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	let openedUrl: string | null = null;

	function makeViewer(node: HTMLElement) {
		return OpenSeadragon({
			element: node,
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

	function getContentSize() {
		if (!viewer) return null;
		const item = viewer.world.getItemAt(0);
		if (!item) return null;
		const sz = item.getContentSize();
		return { w: sz.x, h: sz.y };
	}

	function normToViewport(pt: Pt) {
		if (!viewer) return null;
		const sz = getContentSize();
		if (!sz) return null;
		const imgPt = new OpenSeadragon.Point(pt.x * sz.w, pt.y * sz.h);
		return viewer.viewport.imageToViewportCoordinates(imgPt);
	}

	function applyFocus(immediate = false) {
		if (!viewer || !focus) return;
		const vp = normToViewport(focus);
		if (!vp) return;
		viewer.viewport.panTo(vp, immediate);
		viewer.viewport.applyConstraints(true);
	}

	function applyZoom(immediate = true) {
		if (!viewer || zoom == null) return;
		const center = viewer.viewport.getCenter(true);
		viewer.viewport.zoomTo(zoom, center, immediate);
		viewer.viewport.applyConstraints(true);
	}

	onMount(async () => {
		if (!el) return;
		viewer = makeViewer(el);

		// If we get an imageUrl after mount, it will open via reactive block below.
	});

	onDestroy(() => viewer?.destroy());

	// Preserve viewport when the image changes
	$: if (viewer && imageUrl && openedUrl !== imageUrl) {
		const hadImage = viewer.world.getItemCount() > 0;

		const prevCenter = hadImage ? viewer.viewport.getCenter(true) : null;
		const prevZoom = hadImage ? viewer.viewport.getZoom(true) : null;

		openedUrl = imageUrl;

		viewer.open({ type: 'image', url: imageUrl });

		viewer.addOnceHandler('open', () => {
			// Restore previous view if we had one
			if (prevCenter && prevZoom != null) {
				viewer!.viewport.panTo(prevCenter, true);
				viewer!.viewport.zoomTo(prevZoom, prevCenter, true);
				viewer!.viewport.applyConstraints(true);
			}

			// Then apply external sync (zoom/focus)
			applyZoom(true);
			applyFocus(false);
		});
	}

	// If focus changes without image change, just pan
	$: if (viewer && focus && openedUrl === imageUrl) {
		applyFocus(false);
	}

	// If zoom changes, apply without resetting
	$: if (viewer && zoom != null && openedUrl === imageUrl) {
		applyZoom(true);
	}
</script>

<div class="osd" bind:this={el}></div>

<style>
	.osd {
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.65);
	}
</style>
