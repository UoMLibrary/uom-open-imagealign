<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { createOSDAnnotator } from '@annotorious/openseadragon';
	import '@annotorious/openseadragon/annotorious-openseadragon.css';
	import type OpenSeadragon from 'openseadragon';

	type AnnotationMode = 'pan' | 'rectangle' | 'polygon';

	type StoreLike<T> = {
		subscribe: (run: (value: T) => void) => () => void;
	};

	type AnnotationSession = {
		annotations: StoreLike<any[]>;
	};

	type Props = {
		viewer: OpenSeadragon.Viewer | null;
		session?: AnnotationSession | null;
		initialMode?: AnnotationMode;
		visible?: boolean;

		onReady?: (payload: { annotator: any; viewer: OpenSeadragon.Viewer }) => void;
		onCreate?: (annotation: any) => void;
		onUpdate?: (annotation: any) => void;
		onDelete?: (annotation: any) => void;
		onSelect?: (id: string | null) => void;
	};

	let {
		viewer,
		session = null,
		initialMode = 'pan',
		visible = true,
		onReady,
		onCreate,
		onUpdate,
		onDelete,
		onSelect
	}: Props = $props();
	const initialModeSnapshot = untrack(() => initialMode);

	let annotator = $state.raw<any>(null);
	let initializedForViewer = $state.raw<OpenSeadragon.Viewer | null>(null);
	let unsubscribeSessionAnnotations: (() => void) | null = null;

	let mode = $state<AnnotationMode>(initialModeSnapshot);
	let knownIds = new Set<string>();
	let annotationSigs = new Map<string, string>();
	let suppressedDeleteIds = new Set<string>();
	let pendingProgrammaticSelection: string | null | undefined = undefined;
	let ignoreSelectionChangedUntil = 0;

	function annotationSignature(annotation: any) {
		try {
			return JSON.stringify(annotation);
		} catch {
			return `${annotation?.id ?? ''}`;
		}
	}

	function teardownAnnotator() {
		unsubscribeSessionAnnotations?.();
		unsubscribeSessionAnnotations = null;

		for (const id of knownIds) {
			suppressedDeleteIds.add(id);
		}
		annotator?.destroy?.();
		annotator = null;

		initializedForViewer = null;
		knownIds = new Set<string>();
		annotationSigs = new Map<string, string>();
		suppressedDeleteIds = new Set<string>();
		pendingProgrammaticSelection = undefined;
		ignoreSelectionChangedUntil = 0;
	}

	function beginProgrammaticSelection(id: string | null) {
		pendingProgrammaticSelection = id;
		ignoreSelectionChangedUntil = performance.now() + 120;
	}

	function hydrateFromSession() {
		if (!annotator || !session) return;

		const list = get(session.annotations) ?? [];

		for (const id of knownIds) {
			suppressedDeleteIds.add(id);
		}
		annotator.clearAnnotations?.();

		for (const annotation of list) {
			annotator.addAnnotation?.(annotation);
		}

		knownIds = new Set(list.map((a) => a.id));
		annotationSigs = new Map(list.map((a) => [a.id, annotationSignature(a)]));
	}

	function syncFromSession(list: any[]) {
		if (!annotator) return;

		const nextIds = new Set(list.map((a) => a.id));
		const nextSigs = new Map(list.map((a) => [a.id, annotationSignature(a)]));

		for (const annotation of list) {
			if (!knownIds.has(annotation.id)) {
				annotator.addAnnotation?.(annotation);
				continue;
			}

			const prevSig = annotationSigs.get(annotation.id);
			const nextSig = nextSigs.get(annotation.id);

			if (prevSig !== nextSig) {
				if (typeof annotator.updateAnnotation === 'function') {
					annotator.updateAnnotation(annotation);
				} else {
					annotator.removeAnnotation?.(annotation.id);
					annotator.addAnnotation?.(annotation);
				}
			}
		}

		for (const id of knownIds) {
			if (!nextIds.has(id)) {
				suppressedDeleteIds.add(id);
				annotator.removeAnnotation?.(id);
			}
		}

		knownIds = nextIds;
		annotationSigs = nextSigs;
	}

	function startSessionSync() {
		if (!session?.annotations || !annotator) return;

		unsubscribeSessionAnnotations?.();

		unsubscribeSessionAnnotations = session.annotations.subscribe((list) => {
			syncFromSession(list ?? []);
		});
	}

	function setPanMode() {
		if (!annotator || !viewer) return;

		annotator.setDrawingEnabled?.(false);
		viewer.setMouseNavEnabled(true);
		mode = 'pan';
	}

	function setRectangleMode() {
		if (!annotator || !viewer) return;

		viewer.setMouseNavEnabled(false);
		annotator.setDrawingTool?.('rectangle');
		annotator.setDrawingEnabled?.(true);
		mode = 'rectangle';
	}

	function setPolygonMode() {
		if (!annotator || !viewer) return;

		viewer.setMouseNavEnabled(false);
		annotator.setDrawingTool?.('polygon');
		annotator.setDrawingEnabled?.(true);
		mode = 'polygon';
	}

	function applyMode(nextMode: AnnotationMode) {
		if (!visible) return;

		if (nextMode === 'pan') setPanMode();
		if (nextMode === 'rectangle') setRectangleMode();
		if (nextMode === 'polygon') setPolygonMode();
	}

	function applyVisibility() {
		if (!annotator) return;

		if (visible) {
			annotator.setVisible?.(true);
			annotator.setFilter?.(); // clear filter
			applyMode(mode);
		} else {
			beginProgrammaticSelection(null);
			annotator.setSelected?.();
			annotator.setVisible?.(false);
			annotator.setFilter?.(() => false);
			annotator.setDrawingEnabled?.(false);

			if (viewer) {
				viewer.setMouseNavEnabled(true);
			}
		}

		requestViewerRedraw();
	}

	function initAnnotator(nextViewer: OpenSeadragon.Viewer) {
		if (annotator || initializedForViewer === nextViewer) return;

		annotator = createOSDAnnotator(nextViewer);
		if (!annotator) return;

		initializedForViewer = nextViewer;

		annotator.on?.('createAnnotation', (annotation: any) => {
			knownIds.add(annotation.id);
			annotationSigs.set(annotation.id, annotationSignature(annotation));
			onCreate?.(annotation);
		});

		annotator.on?.('updateAnnotation', (annotation: any) => {
			knownIds.add(annotation.id);
			annotationSigs.set(annotation.id, annotationSignature(annotation));
			onUpdate?.(annotation);
		});

		annotator.on?.('deleteAnnotation', (annotation: any) => {
			const id = annotation?.id;
			if (id) {
				knownIds.delete(id);
				annotationSigs.delete(id);
				if (suppressedDeleteIds.has(id)) {
					suppressedDeleteIds.delete(id);
					return;
				}
			}
			onDelete?.(annotation);
		});

		annotator.on?.('selectionChanged', (selection: any[]) => {
			const id = selection?.[0]?.id ?? null;

			if (pendingProgrammaticSelection !== undefined && performance.now() <= ignoreSelectionChangedUntil) {
				if (id === pendingProgrammaticSelection || id === null) {
					if (id === pendingProgrammaticSelection) {
						pendingProgrammaticSelection = undefined;
					}
					return;
				}
			}

			pendingProgrammaticSelection = undefined;
			onSelect?.(id);
		});

		hydrateFromSession();
		startSessionSync();
		applyVisibility();

		onReady?.({
			annotator,
			viewer: nextViewer
		});
	}

	function requestViewerRedraw() {
		const v: any = viewer;
		if (!v) return;

		if (typeof v.forceRedraw === 'function') v.forceRedraw();
		else if ((viewer?.world as any)?.requestDraw) (viewer.world as any).requestDraw();

		requestAnimationFrame(() => {
			const v2: any = viewer;
			if (typeof v2?.forceRedraw === 'function') v2.forceRedraw();
			else if ((viewer?.world as any)?.requestDraw) (viewer.world as any).requestDraw();
		});
	}

	$effect(() => {
		if (!viewer) {
			teardownAnnotator();
			return;
		}

		if (viewer === initializedForViewer) return;

		teardownAnnotator();

		if (viewer.world?.getItemCount() > 0) {
			initAnnotator(viewer);
			return;
		}

		const handleOpen = () => initAnnotator(viewer);
		viewer.addOnceHandler('open', handleOpen);
	});

	$effect(() => {
		const currentAnnotator = annotator;
		const currentVisible = visible;

		if (!currentAnnotator) return;

		applyVisibility();
	});

	onDestroy(() => {
		teardownAnnotator();
	});

	export function pan() {
		mode = 'pan';
		applyMode(mode);
	}

	export function rectangle() {
		mode = 'rectangle';
		applyMode(mode);
	}

	export function polygon() {
		mode = 'polygon';
		applyMode(mode);
	}

	export function setMode(nextMode: AnnotationMode) {
		mode = nextMode;
		applyMode(mode);
	}

	export function getMode() {
		return mode;
	}

	export function setAnnotationsVisible(nextVisible: boolean) {
		visible = nextVisible;
		applyVisibility();
	}

	export function toggleAnnotationsVisible() {
		visible = !visible;
		applyVisibility();
		return visible;
	}

	export function getAnnotationsVisible() {
		return visible;
	}

	export function select(id: string | null) {
		if (!annotator || !visible) return;
		beginProgrammaticSelection(id);
		if (id) annotator.setSelected?.(id);
		else annotator.setSelected?.();
	}

	export function clearSelection() {
		if (!annotator) return;
		beginProgrammaticSelection(null);
		annotator.setSelected?.();
	}

	export function getAnnotator() {
		return annotator;
	}
</script>
