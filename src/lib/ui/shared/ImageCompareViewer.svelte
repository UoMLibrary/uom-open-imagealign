<script lang="ts">
	import { onMount, tick } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	type Pt = { x: number; y: number };

	type Drawer = 'auto' | 'canvas' | 'webgl' | 'html' | Array<string>;

	export type ImageCompareViewerReadyPayload = {
		viewer: OpenSeadragon.Viewer;
		element: HTMLDivElement;
	};

	export function focusSurface() {
		el?.focus({ preventScroll: true });
	}

	type Props = {
		imageUrl?: string | null;
		overlayUrl?: string | null;

		overlayOpacity?: number;
		overlayCompositeOperation?: string | null;

		wheelAdjustOpacity?: boolean;
		wheelAdjustRequiresShift?: boolean;

		wheelUseFixedStep?: boolean;
		wheelOpacityStep?: number;
		wheelSensitivityPctPerPx?: number;

		refreshKey?: number;
		mode?: string | null;
		focus?: Pt | null;

		drawer?: Drawer;

		enableHoldDifferencePreview?: boolean;
		holdDifferenceKey?: string;

		enableHoldShowBasePreview?: boolean;
		holdShowBaseKey?: string;

		holdDifferenceOpacity?: number;

		onReady?: (payload: ImageCompareViewerReadyPayload) => void;
	};

	let {
		imageUrl = null,
		overlayUrl = null,

		overlayOpacity = $bindable(0.6),
		overlayCompositeOperation = null,

		wheelAdjustOpacity = true,
		wheelAdjustRequiresShift = true,

		wheelUseFixedStep = true,
		wheelOpacityStep = 0.2,
		wheelSensitivityPctPerPx = 0.05,

		refreshKey = 0,
		mode = null,
		focus = null,

		drawer = 'canvas',

		enableHoldDifferencePreview = false,
		holdDifferenceKey = 'q',

		enableHoldShowBasePreview = true,
		holdShowBaseKey = 'e',

		holdDifferenceOpacity = 1,

		onReady
	}: Props = $props();

	const HIDDEN_EPSILON = 0.0001;

	let el: HTMLDivElement | null = null;
	let viewer = $state.raw<OpenSeadragon.Viewer | null>(null);

	let openedBaseSig: string | null = null;
	let openedOverlaySig: string | null = null;
	let lastAppliedFocusSig: string | null = null;

	let pendingAppearance = false;
	let pendingOpacity = overlayOpacity;
	let pendingComposite: string | null = overlayCompositeOperation;

	let holdDifferenceActive = $state(false);
	let holdShowBaseActive = $state(false);

	function makeViewer(node: HTMLElement) {
		return OpenSeadragon({
			element: node,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/',
			showNavigator: true,
			autoResize: true,
			drawer,
			navigatorSizeRatio: 0.16,
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
			showHomeControl: false,
			showZoomControl: false,
			silenceMultiImageWarnings: true
		});
	}

	function forceViewerResize() {
		const v: any = viewer;
		if (!v) return;
		if (typeof v.forceResize === 'function') v.forceResize();
	}

	function requestRedraw() {
		if (!viewer) return;

		const v: any = viewer;
		if (typeof v.forceRedraw === 'function') v.forceRedraw();
		else if ((viewer.world as any)?.requestDraw) (viewer.world as any).requestDraw();

		requestAnimationFrame(() => {
			const v2: any = viewer;
			if (typeof v2?.forceRedraw === 'function') v2.forceRedraw();
			else if ((viewer?.world as any)?.requestDraw) (viewer.world as any).requestDraw();
		});
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

	function effectiveOverlayOpacity() {
		if (enableHoldShowBasePreview && holdShowBaseActive) {
			return HIDDEN_EPSILON;
		}

		if (enableHoldDifferencePreview && holdDifferenceActive && overlayUrl) {
			return Math.max(HIDDEN_EPSILON, clamp01(holdDifferenceOpacity));
		}

		const opacity = clamp01(overlayOpacity);
		if (overlayUrl && opacity <= 0) return HIDDEN_EPSILON;
		return opacity;
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
			opacity: effectiveOverlayOpacity(),
			compositeOperation: effectiveCompositeOperation() ?? undefined,
			success: () => {
				forceViewerResize();
				requestRedraw();
			}
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
		pendingOpacity = effectiveOverlayOpacity();
		pendingComposite = effectiveCompositeOperation();

		if (pendingAppearance) return;
		pendingAppearance = true;

		requestAnimationFrame(() => {
			pendingAppearance = false;
			if (!viewer) return;

			const item: any = overlayItem();
			if (!item) return;

			const op = pendingOpacity;
			if (item.setOpacity) item.setOpacity(op);

			const composite = pendingComposite ?? 'source-over';
			if (item.setCompositeOperation) item.setCompositeOperation(composite);
			else item.compositeOperation = composite;

			requestRedraw();

			requestAnimationFrame(() => {
				requestRedraw();
			});
		});
	}

	function wheelPixelsFromOriginalEvent(e: any) {
		const oe = e.originalEvent as WheelEvent | undefined;
		if (!oe) return 0;

		let dominant: number;

		if (oe.shiftKey && oe.deltaX !== 0) {
			dominant = oe.deltaX;
		} else if (Math.abs(oe.deltaY) >= Math.abs(oe.deltaX) && oe.deltaY !== 0) {
			dominant = oe.deltaY;
		} else {
			dominant = oe.deltaX;
		}

		if (oe.deltaMode === 1) return dominant * 16;
		if (oe.deltaMode === 2) return dominant * 800;
		return dominant;
	}

	function wheelDirectionFromOriginalEvent(e: any) {
		const oe = e.originalEvent as WheelEvent | undefined;
		if (!oe) return 0;

		let dominant: number;

		if (oe.shiftKey && oe.deltaX !== 0) {
			dominant = oe.deltaX;
		} else if (Math.abs(oe.deltaY) >= Math.abs(oe.deltaX) && oe.deltaY !== 0) {
			dominant = oe.deltaY;
		} else {
			dominant = oe.deltaX;
		}

		if (dominant === 0) return 0;
		return dominant > 0 ? 1 : -1;
	}

	function onCanvasScroll(e: any) {
		const oe = e.originalEvent as WheelEvent | undefined;
		if (!oe) return;

		const handled = applyOpacityWheelDeltaFromNativeEvent(oe);
		if (!handled) return;

		e.preventDefaultAction = true;
		e.preventDefault = true;
	}

	function isEditableTarget(target: EventTarget | null) {
		const node = target as HTMLElement | null;
		if (!node) return false;
		if (node instanceof HTMLInputElement) return true;
		if (node instanceof HTMLTextAreaElement) return true;
		if (node instanceof HTMLSelectElement) return true;
		if (node.isContentEditable) return true;
		return !!node.closest?.('[contenteditable="true"]');
	}

	function matchesConfiguredKey(e: KeyboardEvent, configured: string) {
		const wanted = configured.toLowerCase();

		if (e.key.toLowerCase() === wanted) return true;
		if (e.code.toLowerCase() === wanted) return true;

		if (configured.length === 1 && e.code === `Key${configured.toUpperCase()}`) {
			return true;
		}

		return false;
	}

	function onWindowKeyDown(e: KeyboardEvent) {
		if (isEditableTarget(e.target)) return;
		if (!overlayUrl) return;

		let changed = false;

		if (
			enableHoldDifferencePreview &&
			matchesConfiguredKey(e, holdDifferenceKey) &&
			!holdDifferenceActive
		) {
			holdDifferenceActive = true;
			changed = true;
		}

		if (
			enableHoldShowBasePreview &&
			matchesConfiguredKey(e, holdShowBaseKey) &&
			!holdShowBaseActive
		) {
			holdShowBaseActive = true;
			changed = true;
		}

		if (changed) {
			scheduleOverlayAppearance();
		}
	}

	function onWindowKeyUp(e: KeyboardEvent) {
		let changed = false;

		if (
			enableHoldDifferencePreview &&
			matchesConfiguredKey(e, holdDifferenceKey) &&
			holdDifferenceActive
		) {
			holdDifferenceActive = false;
			changed = true;
		}

		if (
			enableHoldShowBasePreview &&
			matchesConfiguredKey(e, holdShowBaseKey) &&
			holdShowBaseActive
		) {
			holdShowBaseActive = false;
			changed = true;
		}

		if (changed) {
			scheduleOverlayAppearance();
		}
	}

	function onWindowBlur() {
		if (!holdDifferenceActive && !holdShowBaseActive) return;

		holdDifferenceActive = false;
		holdShowBaseActive = false;
		scheduleOverlayAppearance();
	}

	function applyOpacityWheelDeltaFromNativeEvent(oe: WheelEvent) {
		if (!wheelAdjustOpacity) return false;
		if (!overlayUrl) return false;

		const shiftHeld = oe.shiftKey;
		if (wheelAdjustRequiresShift && !shiftHeld) return false;

		oe.preventDefault();
		oe.stopPropagation();

		let dominant: number;

		if (oe.shiftKey && oe.deltaX !== 0) {
			dominant = oe.deltaX;
		} else if (Math.abs(oe.deltaY) >= Math.abs(oe.deltaX) && oe.deltaY !== 0) {
			dominant = oe.deltaY;
		} else {
			dominant = oe.deltaX;
		}

		if (wheelUseFixedStep) {
			if (dominant === 0) return true;

			const dir = dominant > 0 ? 1 : -1;
			const delta = -dir * wheelOpacityStep;
			overlayOpacity = clamp(overlayOpacity + delta, 0, 1);
			return true;
		}

		if (oe.deltaMode === 1) dominant *= 16;
		if (oe.deltaMode === 2) dominant *= 800;

		const delta = (-dominant * wheelSensitivityPctPerPx) / 100;
		overlayOpacity = clamp(overlayOpacity + delta, 0, 1);

		return true;
	}

	function onNativeWheel(e: WheelEvent) {
		applyOpacityWheelDeltaFromNativeEvent(e);
	}

	onMount(() => {
		let destroyed = false;

		async function setup() {
			await tick();
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

			if (!el || destroyed) return;

			viewer = makeViewer(el);
			viewer.addHandler('canvas-scroll', onCanvasScroll);
			el.addEventListener('wheel', onNativeWheel, { passive: false, capture: true });

			onReady?.({
				viewer,
				element: el
			});

			forceViewerResize();
			requestAnimationFrame(() => {
				forceViewerResize();
				requestRedraw();
			});
		}

		void setup();

		window.addEventListener('keydown', onWindowKeyDown);
		window.addEventListener('keyup', onWindowKeyUp);
		window.addEventListener('blur', onWindowBlur);

		return () => {
			destroyed = true;

			el?.removeEventListener('wheel', onNativeWheel, true);

			if (viewer) {
				viewer.removeHandler('canvas-scroll', onCanvasScroll);
			}

			window.removeEventListener('keydown', onWindowKeyDown);
			window.removeEventListener('keyup', onWindowKeyUp);
			window.removeEventListener('blur', onWindowBlur);

			viewer?.destroy();
			viewer = null;
		};
	});

	$effect(() => {
		if (!viewer) return;

		if (!imageUrl) {
			if (viewer.world.getItemCount() > 0) viewer.world.removeAll();
			openedBaseSig = null;
			openedOverlaySig = null;
			return;
		}

		const baseKey = isDynamicUrl(imageUrl) ? refreshKey : 0;
		const nextBaseSig = `${imageUrl}|${baseKey}|${mode ?? ''}`;

		if (openedBaseSig === nextBaseSig) return;

		const hadImage = viewer.world.getItemCount() > 0;
		const prevCenter = hadImage ? viewer.viewport.getCenter(true) : null;
		const prevZoom = hadImage ? viewer.viewport.getZoom(true) : null;

		openedBaseSig = nextBaseSig;

		viewer.addOnceHandler('open', () => {
			forceViewerResize();

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

			requestAnimationFrame(() => {
				forceViewerResize();
				requestRedraw();
			});
		});

		viewer.open({ type: 'image', url: cacheBust(imageUrl, 'base') });
	});

	$effect(() => {
		if (!viewer) return;

		if (!overlayUrl && openedOverlaySig) {
			removeOverlay();
			return;
		}

		if (!overlayUrl) return;

		const overlayKey = isDynamicUrl(overlayUrl) ? refreshKey : 0;
		const nextOverlaySig = `${overlayUrl}|${overlayKey}|${mode ?? ''}`;

		if (openedOverlaySig !== nextOverlaySig) {
			if (baseItem()) setOrReplaceOverlay(overlayUrl);
		}
	});

	$effect(() => {
		if (!viewer || !overlayUrl) return;
		scheduleOverlayAppearance();
	});

	$effect(() => {
		if (!viewer || !focus) return;

		const sig = `${focus.x},${focus.y}`;
		if (lastAppliedFocusSig !== sig) {
			lastAppliedFocusSig = sig;
			applyFocus(false);
		}
	});
</script>

<div class="wheel-capture">
	<div class="osd" bind:this={el} tabindex="-1"></div>
</div>

<style>
	.wheel-capture {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.osd {
		position: absolute;
		inset: 0;
		min-height: 0;
		background: rgba(255, 255, 255, 0.65);
	}

	.osd:focus,
	.osd:focus-visible {
		outline: none;
		box-shadow: none;
	}
</style>
