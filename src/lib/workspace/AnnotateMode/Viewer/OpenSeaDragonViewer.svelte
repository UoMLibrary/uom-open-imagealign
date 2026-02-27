<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	export let imageA;
	export let imageB;
	export let overlayOpacity = 0.5;

	let viewerEl;
	let viewer;
	let overlayItem;

	const originalWarn = console.warn;

	const dispatch = createEventDispatcher();

	function initViewer() {
		viewer = OpenSeadragon({
			element: viewerEl,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',
			showNavigator: true,
			autoResize: true,

			// Zoom behaviour
			minZoomLevel: 0.1,
			maxZoomLevel: 20,

			// THIS is the key one
			maxZoomPixelRatio: 5,

			// IMPORTANT
			keyboardNavEnabled: false,

			// THIS is the missing piece
			gestureSettingsKeyboard: {
				rotate: false
			},

			gestureSettingsMouse: {
				dragToPan: true, // left button (normal)
				clickToZoom: false, // optional
				scrollToZoom: true,
				dblClickToZoom: false,
				pinchToZoom: true,

				//  THIS is the key
				dragToPanButton: true // middle mouse button
			}
		});

		viewer.viewport.silenceMultiImageWarnings = true;

		viewer.open([
			{
				tileSource: { type: 'image', url: imageA },
				opacity: 1
			},
			{
				tileSource: { type: 'image', url: imageB },
				opacity: overlayOpacity
			}
		]);

		viewer.addHandler('open', () => {
			overlayItem = viewer.world.getItemAt(1);

			dispatch('ready', { viewer });
		});
	}

	onMount(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(initViewer);
		});
	});

	$: if (overlayItem) {
		overlayItem.setOpacity(overlayOpacity);
	}

	onDestroy(() => viewer?.destroy());
</script>

<div class="viewer" bind:this={viewerEl}></div>

<style>
	.viewer {
		position: relative;
		inset: 0;
		width: 100%;
		height: 100%;
		background: #000;
		/*pointer-events: none; Stop open sea dragon capturing the pointer events */
	}
</style>
