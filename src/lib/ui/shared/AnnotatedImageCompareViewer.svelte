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
		selectedAnnotationId?: string | null;

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
		selectedAnnotationId = $bindable<string | null>(null),

		onViewerReady,
		onAnnotationReady,
		onCreate,
		onUpdate,
		onDelete,
		onSelect
	}: Props = $props();

	let viewer = $state.raw<OpenSeadragon.Viewer | null>(null);
	let annotationLayer: AnnotationLayerHandle | null = null;

	let unsubSelectedId: (() => void) | null = null;
	let unsubViewState: (() => void) | null = null;

	function isEditableTarget(target: EventTarget | null) {
		const node = target as HTMLElement | null;
		if (!node) return false;
		if (node instanceof HTMLInputElement) return true;
		if (node instanceof HTMLTextAreaElement) return true;
		if (node instanceof HTMLSelectElement) return true;
		if (node.isContentEditable) return true;
		return !!node.closest?.('[contenteditable="true"]');
	}

	function applyAnnotationMode(nextMode: AnnotationMode) {
		annotationMode = nextMode;

		if (!annotationLayer) return;

		annotationLayer.clearSelection();

		if (nextMode === 'pan') annotationLayer.pan();
		if (nextMode === 'rectangle') annotationLayer.rectangle();
		if (nextMode === 'polygon') annotationLayer.polygon();
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
		unsubViewState?.();
	});

	$effect(() => {
		unsubSelectedId?.();
		unsubViewState?.();

		if (!session) return;

		if (session.selectedId?.subscribe) {
			unsubSelectedId = session.selectedId.subscribe((id) => {
				selectedAnnotationId = id;
			});
		} else {
			unsubSelectedId = null;
		}

		if (session.viewState?.subscribe) {
			unsubViewState = session.viewState.subscribe((state) => {
				const nextOpacity = state?.overlayOpacity;
				if (typeof nextOpacity === 'number' && nextOpacity !== overlayOpacity) {
					overlayOpacity = nextOpacity;
				}
			});
		} else {
			unsubViewState = null;
		}

		return () => {
			unsubSelectedId?.();
			unsubSelectedId = null;

			unsubViewState?.();
			unsubViewState = null;
		};
	});

	$effect(() => {
		if (!session?.viewState?.update) return;

		session.viewState.update((state) => {
			if (state?.overlayOpacity === overlayOpacity) return state;
			return { ...(state ?? {}), overlayOpacity };
		});
	});

	$effect(() => {
		if (!annotationLayer) return;
		annotationLayer.setMode(annotationMode);
	});

	$effect(() => {
		if (!annotationLayer) return;

		if (selectedAnnotationId) {
			annotationLayer.select(selectedAnnotationId);
		} else {
			annotationLayer.clearSelection();
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
		outline: none;
		cursor: grab;
	}

	.viewer-root:active {
		cursor: grabbing;
	}

	.viewer-root.draw-mode,
	.viewer-root.draw-mode:active {
		cursor: crosshair;
	}
</style>
