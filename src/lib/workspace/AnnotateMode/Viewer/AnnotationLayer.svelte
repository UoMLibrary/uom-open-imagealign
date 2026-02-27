<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import { createOSDAnnotator } from '@annotorious/openseadragon';
	import '@annotorious/openseadragon/annotorious-openseadragon.css';

	export let viewer;
	export let session;

	const dispatch = createEventDispatcher();

	let anno = null;
	let mode = 'pan';
	let initialized = false;

	let unsubscribe;
	let knownIds = new Set();

	/* ---------- INITIALISATION ---------- */

	function initAnnotator() {
		if (initialized || !viewer) return;

		anno = createOSDAnnotator(viewer);
		if (!anno) return;

		initialized = true;

		// anno.on('createAnnotation', (a) => dispatch('create', a));
		anno.on('createAnnotation', (a) => {
			knownIds.add(a.id); //  prevent echo
			dispatch('create', a);
		});

		anno.on('updateAnnotation', (a) => dispatch('update', a));
		anno.on('deleteAnnotation', (a) => dispatch('delete', a));
		anno.on('selectionChanged', (selection) => {
			const id = selection?.[0]?.id ?? null;
			dispatch('select', id);
		});

		setPanMode();

		// 🔑 CRITICAL FIXES
		hydrateFromSession();
		startSessionSync();
	}

	/* ---------- SESSION → ANNOTORIOUS ---------- */

	function hydrateFromSession() {
		if (!anno || !session) return;

		const list = get(session.annotations);

		anno.clearAnnotations();

		for (const a of list) {
			anno.addAnnotation(a);
		}

		knownIds = new Set(list.map((a) => a.id));
	}

	function startSessionSync() {
		if (!session || !anno) return;

		unsubscribe = session.annotations.subscribe((list) => {
			const nextIds = new Set(list.map((a) => a.id));

			// ➕ add missing annotations
			for (const a of list) {
				if (!knownIds.has(a.id)) {
					anno.addAnnotation(a);
				}
			}

			// ➖ remove deleted annotations
			for (const id of knownIds) {
				if (!nextIds.has(id)) {
					anno.removeAnnotation(id);
				}
			}

			knownIds = nextIds;
		});
	}

	onMount(() => {
		if (!viewer) return;

		if (viewer.world?.getItemCount() > 0) {
			initAnnotator();
		} else {
			viewer.addOnceHandler('open', initAnnotator);
		}
	});

	onDestroy(() => {
		unsubscribe?.();
		anno?.destroy();
	});

	/* ---------- MODES ---------- */

	function setPanMode() {
		if (!anno) return;
		anno.setDrawingEnabled(false);
		viewer.setMouseNavEnabled(true);
		mode = 'pan';
	}

	function setRectangleMode() {
		if (!anno) return;
		viewer.setMouseNavEnabled(false);
		anno.setDrawingTool('rectangle');
		anno.setDrawingEnabled(true);
		mode = 'rectangle';
	}

	function setPolygonMode() {
		if (!anno) return;
		viewer.setMouseNavEnabled(false);
		anno.setDrawingTool('polygon');
		anno.setDrawingEnabled(true);
		mode = 'polygon';
	}

	/* ---------- PUBLIC API ---------- */

	export function pan() {
		setPanMode();
	}

	export function rectangle() {
		setRectangleMode();
	}

	export function polygon() {
		setPolygonMode();
	}

	export function getMode() {
		return mode;
	}

	export function select(id) {
		if (!anno) return;
		anno.setSelected(id);
	}

	// export function deleteById(id) {
	// 	anno?.removeAnnotation(id);
	// }

	export function clearSelection() {
		if (!anno) return;
		anno.setSelected(null);
	}
</script>
