<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	type Pt = { x: number; y: number }; // normalised 0..1

	// Base layer (world index 0)
	export let imageUrl: string | null = null;

	// Overlay layer (world index 1)
	export let overlayUrl: string | null = null;

	// Overlay appearance
	export let overlayOpacity: number = 0.6; // expects 0..1
	export let overlayCompositeOperation: string | null = null;

	// Bump this whenever the pixels behind imageUrl/overlayUrl change
	// (point moved, recompute finished, etc.)
	export let refreshKey: number = 0;

	// Optional: a mode tag ("warped" | "composite" | "difference") for cache-busting/signatures
	export let mode: string | null = null;

	// Optional external sync
	export let zoom: number | null = null;
	export let focus: Pt | null = null;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	let el: HTMLDivElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	let openedBaseSig: string | null = null;
	let openedOverlaySig: string | null = null;

	// Track last *applied* external sync, so we don't override user zoom/pan on refresh
	let lastAppliedZoom: number | null = null;
	let lastAppliedFocusSig: string | null = null;

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

	function requestRedraw() {
		if (!viewer) return;
		const v: any = viewer;
		// best-effort across OSD versions
		if (typeof v.forceRedraw === 'function') v.forceRedraw();
		else if (viewer.world && (viewer.world as any).requestDraw) (viewer.world as any).requestDraw();
	}

	function cacheBust(url: string) {
		// Don't break data:/blob: URLs by adding query params.
		// Use a fragment so the string changes (OSD will reload) but the payload stays valid.
		const base = url.split('#')[0];
		const frag = `v=${refreshKey}&m=${encodeURIComponent(mode ?? '')}`;

		if (base.startsWith('data:') || base.startsWith('blob:')) {
			return `${base}#${frag}`;
		}

		try {
			const u = new URL(base, window.location.href);
			u.searchParams.set('_v', String(refreshKey));
			if (mode) u.searchParams.set('_m', mode);
			u.hash = frag;
			return u.toString();
		} catch {
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

	function clamp01(n: any) {
		const v = Number(n);
		if (!Number.isFinite(v)) return 1;
		return Math.max(0, Math.min(1, v));
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

			opacity: clamp01(overlayOpacity),
			compositeOperation: overlayCompositeOperation ?? undefined,

			success: () => requestRedraw()
		} as any);

		openedOverlaySig = `${url}|${refreshKey}|${mode ?? ''}`;
	}

	function removeOverlay() {
		if (!viewer) return;
		const item: any = overlayItem();
		if (!item) return;
		viewer.world.removeItem(item);
		openedOverlaySig = null;
		requestRedraw();
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

		const op = clamp01(overlayOpacity);
		if (item.setOpacity) item.setOpacity(op);

		// Reset to default when null
		if (item.setCompositeOperation) {
			item.setCompositeOperation(overlayCompositeOperation ?? 'source-over');
		} else {
			item.compositeOperation = overlayCompositeOperation ?? 'source-over';
		}

		requestRedraw();
	}

	onMount(() => {
		if (!el) return;
		viewer = makeViewer(el);
	});

	onDestroy(() => viewer?.destroy());

	/* ---------------------------
	   Base image open (index 0)
	   Preserves viewport on refresh.
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

				// IMPORTANT: handler BEFORE open (data: URLs can load very fast)
				viewer.addOnceHandler('open', () => {
					// restore viewport exactly where user left it
					if (prevCenter && prevZoom != null) {
						viewer!.viewport.panTo(prevCenter, true);
						viewer!.viewport.zoomTo(prevZoom, prevCenter, true);
						viewer!.viewport.applyConstraints(true);
					}

					// open() replaces world; overlay must be re-added
					if (overlayUrl) {
						openedOverlaySig = null;
						setOrReplaceOverlay(overlayUrl);
					}

					requestRedraw();
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
	   Overlay appearance updates (opacity / composite)
	   Force redraw so it updates immediately.
	--------------------------- */

	$: if (viewer && overlayUrl) {
		// make deps explicit
		overlayOpacity;
		overlayCompositeOperation;
		mode;

		applyOverlayAppearance();
	}

	/* ---------------------------
	   External sync (only when prop changes)
	   Prevents clobbering manual zoom/pan during refresh.
	--------------------------- */

	$: if (viewer && zoom != null) {
		if (lastAppliedZoom !== zoom) {
			lastAppliedZoom = zoom;
			applyZoom(true);
		}
	}

	$: if (viewer && focus) {
		const sig = `${focus.x},${focus.y}`;
		if (lastAppliedFocusSig !== sig) {
			lastAppliedFocusSig = sig;
			applyFocus(false);
		}
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
