<script>
	import { onMount, onDestroy } from 'svelte';
	import OpenSeaDragonViewer from './OpenSeaDragonViewer.svelte';
	import AnnotationLayer from './AnnotationLayer.svelte';
	// import AnnotationsList from './AnnotationsList.svelte';
	// import AnnotationPanel from './AnnotationPanel.svelte';
	import Toolbar from './Toolbar.svelte';

	export let imageA;
	export let imageB;
	export let session;

	let annotations;
	let selectedId;
	let viewState;

	let viewer = null;
	let annoLayer = null;

	let currentMode = 'pan';
	let isShiftDown = false;

	let rootEl;

	$: if (session) {
		({ selectedId, viewState } = session);
	}

	$: overlayOpacity = viewState ? $viewState.overlayOpacity : 0.5;

	$: if (annoLayer && selectedId && $selectedId) {
		annoLayer.select($selectedId);
	}

	// Lifecycle: global event listeners for keyboard + wheel

	onMount(() => {
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('wheel', onWheel, { passive: false });
	});

	onDestroy(() => {
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		window.removeEventListener('wheel', onWheel);
	});

	/* ---------------- Tool control ---------------- */

	function setMode(mode) {
		currentMode = mode;
		annoLayer?.clearSelection();

		if (!annoLayer || !viewer) return;

		if (mode === 'pan') {
			viewer.setMouseNavEnabled(true);
			annoLayer.pan();
		}

		if (mode === 'rectangle') {
			viewer.setMouseNavEnabled(false);
			annoLayer.rectangle();
		}

		if (mode === 'polygon') {
			viewer.setMouseNavEnabled(true);
			annoLayer.polygon();
		}
	}

	// Apply mode once annotator mounts
	$: if (annoLayer) {
		setMode(currentMode);
	}

	/* ---------------- Opacity control ---------------- */

	function setOverlayOpacity(value) {
		if (!viewState) return;

		viewState.update((v) => ({
			...v,
			overlayOpacity: Math.min(1, Math.max(0, value))
		}));
	}

	function handleViewerReady(event) {
		viewer = event.detail.viewer;
	}

	/* ---------------- Keyboard + wheel ---------------- */

	function onKeyDown(e) {
		// Ignore inputs
		if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

		const key = e.key.toLowerCase();

		if (e.key === 'Escape' || key === '1') {
			annoLayer?.clearSelection();
			setMode('pan');
		}
		if (key === 'b' || key === '2') {
			annoLayer?.clearSelection();
			setMode('rectangle');
		}
		if (key === 'p' || key === '3') {
			annoLayer?.clearSelection();
			setMode('polygon');
		}

		if (e.key === 'Shift') isShiftDown = true;
	}

	function onKeyUp(e) {
		if (e.key === 'Shift') isShiftDown = false;
	}

	function onWheel(e) {
		if (!isShiftDown) return;

		e.preventDefault();
		e.stopPropagation(); //  prevent OpenSeadragon from eating it

		// Trackpad-safe: pick dominant axis
		const rawDelta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;

		if (rawDelta === 0) return;

		const sensitivity = 0.002;
		const delta = -rawDelta * sensitivity;

		setOverlayOpacity(overlayOpacity + delta);
	}

	// Annotation events
	function onCreate(e) {
		setMode('pan');
		session.addAnnotation(e.detail);
	}

	function onUpdate(e) {
		session.updateAnnotation(e.detail);
	}

	function onDelete(e) {
		session.removeAnnotation(e.detail.id);
	}

	function onSelect(e) {
		session.selectAnnotation(e.detail);
	}
</script>

<div
	class="viewer-root"
	class:draw-mode={currentMode === 'rectangle' || currentMode === 'polygon'}
	class:fade-mode={isShiftDown}
	bind:this={rootEl}
>
	<!-- Viewer -->
	<OpenSeaDragonViewer
		bind:viewer
		{imageA}
		{imageB}
		{overlayOpacity}
		on:ready={handleViewerReady}
	/>

	<!-- Annotation layer -->
	{#if viewer}
		<AnnotationLayer
			bind:this={annoLayer}
			{viewer}
			{session}
			on:create={onCreate}
			on:update={onUpdate}
			on:delete={onDelete}
			on:select={onSelect}
		/>
	{/if}

	<!-- Toolbar -->
	<Toolbar
		{currentMode}
		{overlayOpacity}
		on:modechange={(e) => setMode(e.detail)}
		on:opacitychange={(e) => setOverlayOpacity(e.detail)}
	/>
</div>

<style>
	.viewer-root {
		position: relative;
		width: 100%;
		height: 100%;
		outline: none; /* prevent focus ring */

		/* Default interaction */
		cursor: grab;
	}

	/* Active pan feedback */
	.viewer-root:active {
		cursor: grabbing;
	}

	/* Drawing tools override */
	.viewer-root.draw-mode {
		cursor: crosshair;
	}

	.viewer-root.draw-mode:active {
		cursor: crosshair;
	}

	/* Fade / opacity adjustment (Shift + wheel) */
	.viewer-root.fade-mode {
		cursor: ns-resize;
	}
</style>
