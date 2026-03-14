<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	type Pt = { x: number; y: number };

	export let imageUrl: string | null = null;
	export let overlayUrl: string | null = null;

	export let overlayOpacity: number = 0.6;
	export let overlayCompositeOperation: string | null = null;

	export let wheelAdjustOpacity = true;
	export let wheelAdjustRequiresShift = true;
	export let wheelSensitivityPctPerPx = 0.05;

	export let refreshKey: number = 0;
	export let mode: string | null = null;
	export let focus: Pt | null = null;

	export let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	// New: temporary hold-to-difference preview
	export let enableHoldDifferencePreview = false;
	export let holdDifferenceKey: 'Control' | 'Shift' | 'Alt' | 'Meta' = 'Control';

	let el: HTMLDivElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	let openedBaseSig: string | null = null;
	let openedOverlaySig: string | null = null;
	let lastAppliedFocusSig: string | null = null;

	let pendingAppearance = false;
	let pendingOpacity = overlayOpacity;
	let pendingComposite: string | null = overlayCompositeOperation;

	let wheelPendingPx = 0;
	let wheelRaf = 0;

	let holdDifferenceActive = false;

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
		if (typeof v.forceRedraw === 'function') v.forceRedraw();
		else if ((viewer.world as any)?.requestDraw) (viewer.world as any).requestDraw();
	}

	function clamp(n: number, min = 0, max = 1) {
		return Math.max(min, Math.min(max, n));
	}

	function clamp01(n: any) {
		const v = Number(n);
		if (!Number.isFinite(v)) return 1;
		return clamp(v, 0, 1);
	}

	function isDynamicUrl(url: string) {
		return url.startsWith('data:') || url.startsWith('blob:');
	}

	function cacheBust(url: string, layer: 'base' | 'overlay') {
		const base = url.split('#')[0];
		const frag = `v=${refreshKey}&m=${encodeURIComponent(mode ?? '')}&l=${layer}`;

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

	function effectiveCompositeOperation() {
		if (enableHoldDifferencePreview && holdDifferenceActive && overlayUrl) {
			return 'difference';
		}
		return overlayCompositeOperation;
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
			tileSource: { type: 'image', url: cacheBust(url, 'overlay') },
			x: b.x,
			y: b.y,
			width: b.width,
			opacity: clamp01(overlayOpacity),
			compositeOperation: effectiveCompositeOperation() ?? undefined,
			success: () => requestRedraw()
		} as any);

		openedOverlaySig = `${url}|${isDynamicUrl(url) ? refreshKey : 0}|${mode ?? ''}`;
	}

	function removeOverlay() {
		if (!viewer) return;
		const item: any = overlayItem();
		if (!item) return;
		viewer.world.removeItem(item);
		openedOverlaySig = null;
		requestRedraw();
	}

	function scheduleOverlayAppearance() {
		pendingOpacity = overlayOpacity;
		pendingComposite = effectiveCompositeOperation();

		if (pendingAppearance) return;
		pendingAppearance = true;

		requestAnimationFrame(() => {
			pendingAppearance = false;
			if (!viewer) return;

			const item: any = overlayItem();
			if (!item) return;

			const op = clamp01(pendingOpacity);
			if (item.setOpacity) item.setOpacity(op);

			if (item.setCompositeOperation) item.setCompositeOperation(pendingComposite ?? 'source-over');
			else item.compositeOperation = pendingComposite ?? 'source-over';

			requestRedraw();
		});
	}

	function wheelPixels(e: WheelEvent) {
		const dominant =
			Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0 ? e.deltaY : e.deltaX;

		if (e.deltaMode === 1) return dominant * 16;
		if (e.deltaMode === 2) return dominant * 800;
		return dominant;
	}

	function onWheel(e: WheelEvent) {
		if (!wheelAdjustOpacity) return;
		if (!overlayUrl) return;
		if (wheelAdjustRequiresShift && !e.shiftKey) return;

		e.preventDefault();
		e.stopPropagation();

		wheelPendingPx += wheelPixels(e);

		if (wheelRaf) return;
		wheelRaf = requestAnimationFrame(() => {
			wheelRaf = 0;
			const delta = (-wheelPendingPx * wheelSensitivityPctPerPx) / 100;
			wheelPendingPx = 0;
			overlayOpacity = clamp(overlayOpacity + delta, 0, 1);
		});
	}

	function matchesHoldKey(e: KeyboardEvent) {
		return e.key === holdDifferenceKey;
	}

	function onWindowKeyDown(e: KeyboardEvent) {
		if (!enableHoldDifferencePreview) return;
		if (!overlayUrl) return;
		if (!matchesHoldKey(e)) return;
		if (holdDifferenceActive) return;

		holdDifferenceActive = true;
		scheduleOverlayAppearance();
	}

	function onWindowKeyUp(e: KeyboardEvent) {
		if (!enableHoldDifferencePreview) return;
		if (!matchesHoldKey(e)) return;
		if (!holdDifferenceActive) return;

		holdDifferenceActive = false;
		scheduleOverlayAppearance();
	}

	function onWindowBlur() {
		if (!holdDifferenceActive) return;
		holdDifferenceActive = false;
		scheduleOverlayAppearance();
	}

	onMount(() => {
		if (!el) return;
		viewer = makeViewer(el);

		window.addEventListener('keydown', onWindowKeyDown);
		window.addEventListener('keyup', onWindowKeyUp);
		window.addEventListener('blur', onWindowBlur);
	});

	onDestroy(() => {
		if (wheelRaf) cancelAnimationFrame(wheelRaf);

		window.removeEventListener('keydown', onWindowKeyDown);
		window.removeEventListener('keyup', onWindowKeyUp);
		window.removeEventListener('blur', onWindowBlur);

		viewer?.destroy();
	});

	$: if (viewer) {
		if (!imageUrl) {
			if (viewer.world.getItemCount() > 0) viewer.world.removeAll();
			openedBaseSig = null;
			openedOverlaySig = null;
		} else {
			const baseKey = isDynamicUrl(imageUrl) ? refreshKey : 0;
			const nextBaseSig = `${imageUrl}|${baseKey}|${mode ?? ''}`;

			if (openedBaseSig !== nextBaseSig) {
				const hadImage = viewer.world.getItemCount() > 0;
				const prevCenter = hadImage ? viewer.viewport.getCenter(true) : null;
				const prevZoom = hadImage ? viewer.viewport.getZoom(true) : null;

				openedBaseSig = nextBaseSig;

				viewer.addOnceHandler('open', () => {
					if (prevCenter && prevZoom != null) {
						viewer!.viewport.panTo(prevCenter, true);
						viewer!.viewport.zoomTo(prevZoom, prevCenter, true);
						viewer!.viewport.applyConstraints(true);
					}

					if (overlayUrl) {
						openedOverlaySig = null;
						setOrReplaceOverlay(overlayUrl);
					}

					applyFocus(true);
					requestRedraw();
				});

				viewer.open({ type: 'image', url: cacheBust(imageUrl, 'base') });
			}
		}
	}

	$: if (viewer) {
		if (!overlayUrl && openedOverlaySig) {
			removeOverlay();
		}

		if (overlayUrl) {
			const overlayKey = isDynamicUrl(overlayUrl) ? refreshKey : 0;
			const nextOverlaySig = `${overlayUrl}|${overlayKey}|${mode ?? ''}`;

			if (openedOverlaySig !== nextOverlaySig) {
				if (baseItem()) setOrReplaceOverlay(overlayUrl);
			}
		}
	}

	$: if (viewer && overlayUrl) {
		overlayOpacity;
		overlayCompositeOperation;
		enableHoldDifferencePreview;
		holdDifferenceActive;
		scheduleOverlayAppearance();
	}

	$: if (viewer && focus) {
		const sig = `${focus.x},${focus.y}`;
		if (lastAppliedFocusSig !== sig) {
			lastAppliedFocusSig = sig;
			applyFocus(false);
		}
	}
</script>

<div class="wheel-capture" on:wheel|capture={onWheel}>
	<div class="osd" bind:this={el}></div>
</div>

<style>
	.wheel-capture {
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.osd {
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.65);
	}
</style>
