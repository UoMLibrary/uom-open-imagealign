<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	type Pt = { x: number; y: number }; // normalised 0..1

	// Base layer (world index 0)
	export let imageUrl: string | null = null;

	// Overlay layer (world index 1) — this is the one you can swap
	export let overlayUrl: string | null = null;

	// Optional overlay appearance
	export let overlayOpacity: number = 0.6;
	export let overlayCompositeOperation: string | null = null;

	// Optional: keep result zoom matched to source/target zoom
	export let zoom: number | null = null;

	// Optional: pan to this point (normalised in base image space)
	export let focus: Pt | null = null;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	let el: HTMLDivElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	let openedBaseUrl: string | null = null;
	let openedOverlayUrl: string | null = null;

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

	function baseItem() {
		return viewer?.world.getItemAt(0) ?? null;
	}

	function overlayItem() {
		return viewer?.world.getItemAt(1) ?? null;
	}

	function baseBounds() {
		const item: any = baseItem();
		if (!item) return null;
		return item.getBoundsNoRotate ? item.getBoundsNoRotate(true) : item.getBounds(true);
	}

	function setOrReplaceOverlay(url: string) {
		if (!viewer) return;
		const base = baseItem() as any;
		if (!base) return;

		const b = baseBounds();
		if (!b) return;

		const hasOverlay = !!overlayItem();

		viewer.addTiledImage({
			index: 1,
			// only use replace if the overlay exists already (OSD 5.0.1 asserts index validity) :contentReference[oaicite:2]{index=2}
			replace: hasOverlay,
			tileSource: { type: 'image', url },

			// match base placement (assumes same dimensions/aspect)
			x: b.x,
			y: b.y,
			width: b.width,

			opacity: overlayOpacity,
			compositeOperation: overlayCompositeOperation ?? undefined
		} as any);

		openedOverlayUrl = url;
	}

	function removeOverlay() {
		if (!viewer) return;
		const item: any = overlayItem();
		if (!item) return;
		viewer.world.removeItem(item);
		openedOverlayUrl = null;
	}

	function getContentSize() {
		if (!viewer) return null;
		const item: any = baseItem();
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

	function applyOverlayAppearance() {
		if (!viewer) return;
		const item: any = overlayItem();
		if (!item) return;

		if (item.setOpacity) item.setOpacity(overlayOpacity);
		if (overlayCompositeOperation != null && item.setCompositeOperation) {
			item.setCompositeOperation(overlayCompositeOperation);
		}
	}

	onMount(() => {
		if (!el) return;
		viewer = makeViewer(el);
	});

	onDestroy(() => viewer?.destroy());

	/* ---------------------------
	   Base image open (index 0)
	--------------------------- */

	$: if (viewer && imageUrl && openedBaseUrl !== imageUrl) {
		const hadImage = viewer.world.getItemCount() > 0;

		const prevCenter = hadImage ? viewer.viewport.getCenter(true) : null;
		const prevZoom = hadImage ? viewer.viewport.getZoom(true) : null;

		openedBaseUrl = imageUrl;

		// Use open() for the base, since your component already depends on it.
		viewer.open({ type: 'image', url: imageUrl });

		viewer.addOnceHandler('open', () => {
			if (prevCenter && prevZoom != null) {
				viewer!.viewport.panTo(prevCenter, true);
				viewer!.viewport.zoomTo(prevZoom, prevCenter, true);
				viewer!.viewport.applyConstraints(true);
			}

			// Ensure overlay is (re)applied after base opens
			if (overlayUrl) setOrReplaceOverlay(overlayUrl);

			applyZoom(true);
			applyFocus(false);
		});
	}

	/* ---------------------------
	   Overlay swap (index 1)
	--------------------------- */

	$: if (viewer) {
		// remove overlay if cleared
		if (!overlayUrl && openedOverlayUrl) {
			removeOverlay();
		}

		// swap overlay without losing viewport
		if (overlayUrl && openedOverlayUrl !== overlayUrl) {
			// only swap once base exists
			if (baseItem()) setOrReplaceOverlay(overlayUrl);
		}

		// update appearance live (no swap)
		if (overlayUrl && openedOverlayUrl === overlayUrl) {
			applyOverlayAppearance();
		}
	}

	/* ---------------------------
	   External sync
	--------------------------- */

	$: if (viewer && focus && openedBaseUrl === imageUrl) {
		applyFocus(false);
	}

	$: if (viewer && zoom != null && openedBaseUrl === imageUrl) {
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
