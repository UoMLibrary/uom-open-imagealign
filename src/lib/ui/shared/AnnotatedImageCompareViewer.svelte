<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type OpenSeadragon from 'openseadragon';
	import ImageCompareViewer, {
		type ImageCompareViewerReadyPayload
	} from './ImageCompareViewer.svelte';
	import ViewerAnnotationLayer from './ViewerAnnotationLayer.svelte';

	type Pt = { x: number; y: number };
	type Drawer = 'auto' | 'canvas' | 'webgl' | 'html' | Array<string>;
	type AnnotationMode = 'pan' | 'rectangle' | 'polygon';

	type StoreLike<T> = {
		subscribe: (run: (value: T) => void) => () => void;
		update?: (updater: (value: T) => T) => void;
		set?: (value: T) => void;
	};

	type AnnotationSession = {
		annotations: StoreLike<any[]>;
		selectedId?: StoreLike<string | null>;
		viewState?: StoreLike<{ overlayOpacity?: number }>;
		addAnnotation?: (annotation: any) => void;
		updateAnnotation?: (annotation: any) => void;
		removeAnnotation?: (id: string) => void;
		selectAnnotation?: (id: string | null) => void;
	};

	type AnnotationLayerHandle = {
		pan: () => void;
		rectangle: () => void;
		polygon: () => void;
		setMode: (mode: AnnotationMode) => void;
		getMode: () => AnnotationMode;
		setAnnotationsVisible: (visible: boolean) => void;
		toggleAnnotationsVisible: () => boolean;
		getAnnotationsVisible: () => boolean;
		select: (id: string | null) => void;
		clearSelection: () => void;
		getAnnotator: () => any;
	};

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

		session?: AnnotationSession | null;
		enableAnnotationShortcuts?: boolean;
		annotationMode?: AnnotationMode;
		annotationsVisible?: boolean;
		selectedAnnotationId?: string | null;

		viewer?: OpenSeadragon.Viewer | null;

		onViewerReady?: (payload: ImageCompareViewerReadyPayload) => void;
		onAnnotationReady?: (payload: { annotator: any; viewer: OpenSeadragon.Viewer }) => void;
		onCreate?: (annotation: any) => void;
		onUpdate?: (annotation: any) => void;
		onDelete?: (annotation: any) => void;
		onSelect?: (id: string | null) => void;
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

		session = null,
		enableAnnotationShortcuts = true,
		annotationMode = $bindable<AnnotationMode>('pan'),
		annotationsVisible = $bindable(true),
		selectedAnnotationId = $bindable<string | null>(null),

		viewer = $bindable<OpenSeadragon.Viewer | null>(null),

		onViewerReady,
		onAnnotationReady,
		onCreate,
		onUpdate,
		onDelete,
		onSelect
	}: Props = $props();

	let annotationLayer: AnnotationLayerHandle | null = null;

	function focusViewerSurface() {
		const node = viewer?.element as HTMLElement | undefined;
		node?.focus({ preventScroll: true });
	}

	let unsubSelectedId: (() => void) | null = null;

	function isEditableTarget(target: EventTarget | null) {
		const node = target as HTMLElement | null;
		if (!node) return false;
		if (node instanceof HTMLInputElement) return true;
		if (node instanceof HTMLTextAreaElement) return true;
		if (node instanceof HTMLSelectElement) return true;
		if (node.isContentEditable) return true;
		return !!node.closest?.('[contenteditable="true"]');
	}

	function applyAnnotationModeToLayer(nextMode: AnnotationMode) {
		if (!annotationLayer) return;

		annotationLayer.clearSelection();

		if (nextMode === 'pan') annotationLayer.pan();
		if (nextMode === 'rectangle') annotationLayer.rectangle();
		if (nextMode === 'polygon') annotationLayer.polygon();

		if (annotationsVisible) {
			focusViewerSurface();
		}
	}

	function applyAnnotationMode(nextMode: AnnotationMode) {
		annotationMode = nextMode;
		applyAnnotationModeToLayer(nextMode);
	}

	function handleViewerReady(payload: ImageCompareViewerReadyPayload) {
		viewer = payload.viewer;
		onViewerReady?.(payload);
	}

	function handleAnnotationReady(payload: { annotator: any; viewer: OpenSeadragon.Viewer }) {
		onAnnotationReady?.(payload);
	}

	function handleCreate(annotation: any) {
		session?.addAnnotation?.(annotation);
		selectedAnnotationId = annotation?.id ?? null;
		session?.selectAnnotation?.(selectedAnnotationId);

		applyAnnotationMode('pan');
		onCreate?.(annotation);
	}

	function handleUpdate(annotation: any) {
		session?.updateAnnotation?.(annotation);
		onUpdate?.(annotation);
	}

	function handleDelete(annotation: any) {
		const id = annotation?.id ?? null;

		if (id) {
			session?.removeAnnotation?.(id);
			if (selectedAnnotationId === id) {
				selectedAnnotationId = null;
				session?.selectAnnotation?.(null);
			}
		}

		onDelete?.(annotation);
	}

	function handleSelect(id: string | null) {
		selectedAnnotationId = id;
		session?.selectAnnotation?.(id);
		onSelect?.(id);
	}

	function onWindowKeyDown(e: KeyboardEvent) {
		if (!enableAnnotationShortcuts) return;
		if (isEditableTarget(e.target)) return;

		const key = e.key.toLowerCase();

		if (key === '4') {
			annotationsVisible = !annotationsVisible;

			if (!annotationsVisible) {
				selectedAnnotationId = null;
				session?.selectAnnotation?.(null);
			} else {
				focusViewerSurface();
			}

			return;
		}

		if (e.key === 'Escape' || key === '1') {
			applyAnnotationMode('pan');
			return;
		}

		if (key === 'b' || key === '2') {
			applyAnnotationMode('rectangle');
			return;
		}

		if (key === 'p' || key === '3') {
			applyAnnotationMode('polygon');
			return;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onWindowKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', onWindowKeyDown);
		unsubSelectedId?.();
		viewer = null;
	});

	$effect(() => {
		unsubSelectedId?.();

		if (!session) return;

		if (session.selectedId?.subscribe) {
			unsubSelectedId = session.selectedId.subscribe((id) => {
				selectedAnnotationId = id;
			});
		} else {
			unsubSelectedId = null;
		}

		return () => {
			unsubSelectedId?.();
			unsubSelectedId = null;
		};
	});

	$effect(() => {
		if (!annotationLayer) return;
		applyAnnotationModeToLayer(annotationMode);
	});

	$effect(() => {
		if (!annotationLayer) return;

		if (selectedAnnotationId) {
			annotationLayer.select(selectedAnnotationId);
		} else {
			annotationLayer.clearSelection();
		}
	});

	$effect(() => {
		if (!annotationLayer) return;
		annotationLayer.setAnnotationsVisible(annotationsVisible);

		if (!annotationsVisible) {
			annotationLayer.clearSelection();
		} else {
			focusViewerSurface();
		}
	});

	export function pan() {
		applyAnnotationMode('pan');
	}

	export function rectangle() {
		applyAnnotationMode('rectangle');
	}

	export function polygon() {
		applyAnnotationMode('polygon');
	}

	export function setAnnotationMode(nextMode: AnnotationMode) {
		applyAnnotationMode(nextMode);
	}

	export function selectAnnotation(id: string | null) {
		selectedAnnotationId = id;
		if (id) {
			annotationLayer?.select(id);
		} else {
			annotationLayer?.clearSelection();
		}
	}

	export function clearAnnotationSelection() {
		selectedAnnotationId = null;
		annotationLayer?.clearSelection();
	}

	export function getViewer() {
		return viewer;
	}

	export function getAnnotator() {
		return annotationLayer?.getAnnotator?.() ?? null;
	}

	export function showAnnotations() {
		annotationsVisible = true;
		focusViewerSurface();
	}

	export function hideAnnotations() {
		annotationsVisible = false;
	}

	export function toggleAnnotationsVisibility() {
		annotationsVisible = !annotationsVisible;
		if (annotationsVisible) focusViewerSurface();
		return annotationsVisible;
	}

	export function getAnnotationsVisible() {
		return annotationsVisible;
	}
</script>

<div
	class="viewer-root"
	class:draw-mode={annotationMode === 'rectangle' || annotationMode === 'polygon'}
>
	<ImageCompareViewer
		{imageUrl}
		{overlayUrl}
		bind:overlayOpacity
		{overlayCompositeOperation}
		{wheelAdjustOpacity}
		{wheelAdjustRequiresShift}
		{wheelUseFixedStep}
		{wheelOpacityStep}
		{wheelSensitivityPctPerPx}
		{refreshKey}
		{mode}
		{focus}
		{drawer}
		{enableHoldDifferencePreview}
		{holdDifferenceKey}
		{enableHoldShowBasePreview}
		{holdShowBaseKey}
		{holdDifferenceOpacity}
		onReady={handleViewerReady}
	/>

	{#if viewer}
		<ViewerAnnotationLayer
			bind:this={annotationLayer}
			{viewer}
			{session}
			initialMode={annotationMode}
			visible={annotationsVisible}
			onReady={handleAnnotationReady}
			onCreate={handleCreate}
			onUpdate={handleUpdate}
			onDelete={handleDelete}
			onSelect={handleSelect}
		/>
	{/if}
</div>

<style>
	.viewer-root {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		border-radius: 12px;
		outline: none;
		cursor: grab;
	}

	.viewer-root:focus,
	.viewer-root:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.viewer-root :global(*:focus),
	.viewer-root :global(*:focus-visible) {
		outline: none !important;
		box-shadow: none !important;
	}

	.viewer-root:active {
		cursor: grabbing;
	}

	.viewer-root.draw-mode,
	.viewer-root.draw-mode:active {
		cursor: crosshair;
	}
</style>
