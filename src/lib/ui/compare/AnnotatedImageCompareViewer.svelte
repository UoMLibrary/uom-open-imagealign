<!-- AnnotatedImageCompareViewer.svelte -->
<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import type OpenSeadragon from 'openseadragon';
	import CompareViewerToolbar from './CompareViewerToolbar.svelte';
	import AnnotationCompareSurface from './AnnotationCompareSurface.svelte';
	import {
		createAnnotationCompareSession,
		type AnnotationCompareSession,
		type AnnotationCompareViewState,
		type AnnotationMode
	} from './annotationCompareSession';

	type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';
	type Pt = { x: number; y: number };
	type Drawer = 'auto' | 'canvas' | 'webgl' | 'html' | Array<string>;

	type Props = {
		imageUrl?: string | null;
		overlayUrl?: string | null;

		annotations?: any[];
		initialViewState?: Partial<AnnotationCompareViewState>;
		session?: AnnotationCompareSession | null;

		showToolbar?: boolean;
		toolbarPosition?: ToolbarPosition;

		refreshKey?: number;
		mode?: string | null;
		focus?: Pt | null;
		drawer?: Drawer;

		wheelAdjustOpacity?: boolean;
		wheelAdjustRequiresShift?: boolean;
		wheelUseFixedStep?: boolean;
		wheelOpacityStep?: number;
		wheelSensitivityPctPerPx?: number;

		enableHoldDifferencePreview?: boolean;
		holdDifferenceKey?: string;
		enableHoldShowBasePreview?: boolean;
		holdShowBaseKey?: string;
		holdDifferenceOpacity?: number;

		enableAnnotationShortcuts?: boolean;

		viewer?: OpenSeadragon.Viewer | null;

		onAnnotationsChange?: (annotations: any[]) => void;
		onViewStateChange?: (viewState: AnnotationCompareViewState) => void;
		onCreate?: (annotation: any) => void;
		onUpdate?: (annotation: any) => void;
		onDelete?: (annotation: any) => void;
		onSelect?: (id: string | null) => void;
	};

	let {
		imageUrl = null,
		overlayUrl = null,

		annotations = [],
		initialViewState = {},
		session = null,

		showToolbar = true,
		toolbarPosition = 'left',

		refreshKey = 0,
		mode = null,
		focus = null,
		drawer = 'canvas',

		wheelAdjustOpacity = true,
		wheelAdjustRequiresShift = true,
		wheelUseFixedStep = true,
		wheelOpacityStep = 0.2,
		wheelSensitivityPctPerPx = 0.05,

		enableHoldDifferencePreview = true,
		holdDifferenceKey = 'q',
		enableHoldShowBasePreview = true,
		holdShowBaseKey = 'e',
		holdDifferenceOpacity = 1,

		enableAnnotationShortcuts = true,

		viewer = $bindable<OpenSeadragon.Viewer | null>(null),

		onAnnotationsChange,
		onViewStateChange,
		onCreate,
		onUpdate,
		onDelete,
		onSelect
	}: Props = $props();

	const initialViewStateSnapshot = untrack(() => ({ ...initialViewState }));
	const initialAnnotationsSnapshot = untrack(() => annotations);
	const localCompareSession = createAnnotationCompareSession({
		annotations: initialAnnotationsSnapshot,
		...initialViewStateSnapshot
	});
	const compareSession = $derived(session ?? localCompareSession);

	let collapsed = $state(initialViewStateSnapshot.collapsed ?? false);
	let overlayOpacity = $state(initialViewStateSnapshot.overlayOpacity ?? 0.6);
	let annotationMode = $state<AnnotationMode>(initialViewStateSnapshot.annotationMode ?? 'pan');
	let annotationsVisible = $state(initialViewStateSnapshot.annotationsVisible ?? true);
	let selectedAnnotationId = $state<string | null>(null);

	let readingFocusEnabled = $state(initialViewStateSnapshot.readingFocusEnabled ?? false);
	let readingFocusClearCenterPct = $state(initialViewStateSnapshot.readingFocusClearCenterPct ?? 30);
	let readingFocusOpacity = $state(initialViewStateSnapshot.readingFocusOpacity ?? 0.35);
	let readingFocusBlurPx = $state(initialViewStateSnapshot.readingFocusBlurPx ?? 0);

	let surface: { cycleReadingFocus: () => void } | null = null;

	function cycleReadingFocus() {
		surface?.cycleReadingFocus();
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

	function onWindowKeyDown(e: KeyboardEvent) {
		if (!showToolbar) return;
		if (isEditableTarget(e.target)) return;

		if (e.key === 't' || e.key === 'T') {
			e.preventDefault();
			collapsed = !collapsed;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onWindowKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', onWindowKeyDown);
	});

	$effect(() => {
		compareSession.patchViewState({
			collapsed,
			overlayOpacity,
			annotationMode,
			annotationsVisible,
			readingFocusEnabled,
			readingFocusClearCenterPct,
			readingFocusOpacity,
			readingFocusBlurPx
		});
	});

	$effect(() => {
		const unsub = compareSession.annotations.subscribe((list) => {
			onAnnotationsChange?.(list);
		});
		return unsub;
	});

	$effect(() => {
		const unsub = compareSession.selectedId.subscribe((id) => {
			selectedAnnotationId = id;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = compareSession.viewState.subscribe((state) => {
			onViewStateChange?.(state);
		});
		return unsub;
	});
</script>

<div class="viewer-shell">
	<AnnotationCompareSurface
		bind:this={surface}
		bind:viewer
		{imageUrl}
		{overlayUrl}
		session={compareSession}
		bind:overlayOpacity
		bind:annotationMode
		bind:annotationsVisible
		bind:selectedAnnotationId
		bind:readingFocusEnabled
		bind:readingFocusClearCenterPct
		bind:readingFocusOpacity
		bind:readingFocusBlurPx
		{refreshKey}
		{mode}
		{focus}
		{drawer}
		{wheelAdjustOpacity}
		{wheelAdjustRequiresShift}
		{wheelUseFixedStep}
		{wheelOpacityStep}
		{wheelSensitivityPctPerPx}
		{enableHoldDifferencePreview}
		{holdDifferenceKey}
		{enableHoldShowBasePreview}
		{holdShowBaseKey}
		{holdDifferenceOpacity}
		{enableAnnotationShortcuts}
		{onCreate}
		{onUpdate}
		{onDelete}
		{onSelect}
	/>

	{#if showToolbar}
		<CompareViewerToolbar
			{viewer}
			position={toolbarPosition}
			bind:collapsed
			bind:overlayOpacity
			bind:annotationMode
			bind:annotationsVisible
			showAnnotationControls={true}
			{readingFocusEnabled}
			{readingFocusClearCenterPct}
			onReadingFocusCycle={cycleReadingFocus}
		/>
	{/if}
</div>

<style>
	.viewer-shell {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
</style>
