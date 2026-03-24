<script lang="ts">
	import { onDestroy } from 'svelte';
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
		onReady,
		onCreate,
		onUpdate,
		onDelete,
		onSelect
	}: Props = $props();

	let annotator: any = null;
	let initializedForViewer: OpenSeadragon.Viewer | null = null;
	let unsubscribeSessionAnnotations: (() => void) | null = null;

	let mode = $state<AnnotationMode>(initialMode);
	let knownIds = new Set<string>();
	let annotationSigs = new Map<string, string>();

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

		annotator?.destroy?.();
		annotator = null;

		initializedForViewer = null;
		knownIds = new Set<string>();
		annotationSigs = new Map<string, string>();
	}

	function hydrateFromSession() {
		if (!annotator || !session) return;

		const list = get(session.annotations) ?? [];

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
		if (nextMode === 'pan') setPanMode();
		if (nextMode === 'rectangle') setRectangleMode();
		if (nextMode === 'polygon') setPolygonMode();
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
			if (annotation?.id) {
				knownIds.delete(annotation.id);
				annotationSigs.delete(annotation.id);
			}
			onDelete?.(annotation);
		});

		annotator.on?.('selectionChanged', (selection: any[]) => {
			const id = selection?.[0]?.id ?? null;
			onSelect?.(id);
		});

		hydrateFromSession();
		startSessionSync();
		applyMode(mode);

		onReady?.({
			annotator,
			viewer: nextViewer
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

	onDestroy(() => {
		teardownAnnotator();
	});

	export function pan() {
		setPanMode();
	}

	export function rectangle() {
		setRectangleMode();
	}

	export function polygon() {
		setPolygonMode();
	}

	export function setMode(nextMode: AnnotationMode) {
		applyMode(nextMode);
	}

	export function getMode() {
		return mode;
	}

	export function select(id: string | null) {
		if (!annotator) return;
		annotator.setSelected?.(id);
	}

	export function clearSelection() {
		if (!annotator) return;
		annotator.setSelected?.(null);
	}

	export function getAnnotator() {
		return annotator;
	}
</script>
