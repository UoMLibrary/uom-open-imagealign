<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	type Pt = { x: number; y: number }; // normalised 0..1

	// Base layer (world index 0)
	export let imageUrl: string | null = null;

	// Overlay layer (world index 1)
	export let overlayUrl: string | null = null;

	// Optional overlay appearance
	export let overlayOpacity: number = 0.6;
	export let overlayCompositeOperation: string | null = null;

	// Bump this whenever the pixels behind imageUrl/overlayUrl change
	// (point moved, recompute finished, etc.)
	export let refreshKey: number = 0;

	// Optional: include your render mode ("composite" | "warped" | "difference")
	// so mode-only changes can force a refresh too.
	export let mode: string | null = null;

	// Optional: keep result zoom matched to source/target zoom
	export let zoom: number | null = null;

	// Optional: pan to this point (normalised in base image space)
	export let focus: Pt | null = null;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	let el: HTMLDivElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	// Track what we've actually opened (url + refreshKey + mode)
	let openedBaseSig: string | null = null;
	let openedOverlaySig: string | null = null;

	function makeViewer(node: HTMLElement) {
		return OpenSeadragon({
			element: node,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/',
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

	function cacheBust(url: string) {
		// For data:/blob: URLs, DO NOT append "?..." (breaks data URLs).
		// Use a fragment instead, so the URL string changes but the data doesn't.
		const base = url.split('#')[0];
		const frag = `v=${refreshKey}&m=${encodeURIComponent(mode ?? '')}`;

		if (base.startsWith('data:') || base.startsWith('blob:')) {
			return `${base}#${frag}`;
		}

		// For http(s)/relative, add query params safely
		try {
			const u = new URL(base, window.location.href);
			u.searchParams.set('_v', String(refreshKey));
			if (mode) u.searchParams.set('_m', mode);
			// keep our fragment too (harmless)
			u.hash = frag;
			return u.toString();
		} catch {
			// Fallback: don’t break the URL if parsing fails
			return url;
		}
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
			replace: hasOverlay,
			tileSource: { type: 'image', url: cacheBust(url) },

			// match base placement (assumes same dimensions/aspect)
			x: b.x,
			y: b.y,
			width: b.width,

			opacity: overlayOpacity,
			compositeOperation: overlayCompositeOperation ?? undefined
		} as any);

		openedOverlaySig = `${url}|${refreshKey}|${mode ?? ''}`;
	}

	function removeOverlay() {
		if (!viewer) return;
		const item: any = overlayItem();
		if (!item) return;
		viewer.world.removeItem(item);
		openedOverlaySig = null;
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
		if (viewer.world.getItemCount() === 0) return;

		const vp = normToViewport(focus);
		if (!vp) return;

		viewer.viewport.panTo(vp, immediate);
		viewer.viewport.applyConstraints(true);
	}

	function applyZoom(immediate = true) {
		if (!viewer || zoom == null) return;
		if (viewer.world.getItemCount() === 0) return;

		const center = viewer.viewport.getCenter(true);
		viewer.viewport.zoomTo(zoom, center, immediate);
		viewer.viewport.applyConstraints(true);
	}

	function applyOverlayAppearance() {
		if (!viewer) return;
		const item: any = overlayItem();
		if (!item) return;

		if (item.setOpacity) item.setOpacity(overlayOpacity);

		// Reset to default when null
		if (item.setCompositeOperation) {
			item.setCompositeOperation(overlayCompositeOperation ?? 'source-over');
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

	$: if (viewer) {
		if (!imageUrl) {
			if (viewer.world.getItemCount() > 0) viewer.world.removeAll();
			openedBaseSig = null;
			openedOverlaySig = null;
		} else {
			const nextBaseSig = `${imageUrl}|${refreshKey}|${mode ?? ''}`;

			if (openedBaseSig !== nextBaseSig) {
				const hadImage = viewer.world.getItemCount() > 0;
				const prevCenter = hadImage ? viewer.viewport.getCenter(true) : null;
				const prevZoom = hadImage ? viewer.viewport.getZoom(true) : null;

				openedBaseSig = nextBaseSig;

				// attach handler BEFORE open
				viewer.addOnceHandler('open', () => {
					if (prevCenter && prevZoom != null) {
						viewer!.viewport.panTo(prevCenter, true);
						viewer!.viewport.zoomTo(prevZoom, prevCenter, true);
						viewer!.viewport.applyConstraints(true);
					}

					// open() replaces world; ensure overlay is re-applied
					if (overlayUrl) {
						openedOverlaySig = null;
						setOrReplaceOverlay(overlayUrl);
					}

					applyZoom(true);
					applyFocus(false);
				});

				viewer.open({ type: 'image', url: cacheBust(imageUrl) });
			}
		}
	}

	/* ---------------------------
	   Overlay swap (index 1)
	--------------------------- */

	$: if (viewer) {
		if (!overlayUrl && openedOverlaySig) {
			removeOverlay();
		}

		if (overlayUrl) {
			const nextOverlaySig = `${overlayUrl}|${refreshKey}|${mode ?? ''}`;

			if (openedOverlaySig !== nextOverlaySig) {
				if (baseItem()) setOrReplaceOverlay(overlayUrl);
			}
		}
	}

	/* ---------------------------
	   Overlay appearance updates
	   Make deps explicit so mode/opacity/composite changes update immediately.
	--------------------------- */

	$: if (viewer && overlayUrl) {
		overlayOpacity;
		overlayCompositeOperation;
		mode;

		applyOverlayAppearance();
	}

	/* ---------------------------
	   External sync
	--------------------------- */

	$: if (viewer && focus) {
		applyFocus(false);
	}

	$: if (viewer && zoom != null) {
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
