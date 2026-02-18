<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let x = 0.5; // normalized
	export let y = 0.5;

	const dispatch = createEventDispatcher();
	export let fullSize = false;

	let dragging = false;
	let container: HTMLDivElement;

	function onPointerDown() {
		dragging = true;
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function onMove(e: PointerEvent) {
		if (!dragging) return;

		const rect = container.getBoundingClientRect();

		x = (e.clientX - rect.left) / rect.width;
		y = (e.clientY - rect.top) / rect.height;

		x = Math.max(0, Math.min(1, x));
		y = Math.max(0, Math.min(1, y));

		dispatch('change', { x, y });
	}

	function onUp() {
		dragging = false;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
	}
</script>

<div class="crosshair-overlay full-size" bind:this={container}>
	<!-- Vertical -->
	<div class="line vertical" style="left: {x * 100}%" />

	<!-- Horizontal -->
	<div class="line horizontal" style="top: {y * 100}%" />

	<!-- Center handle -->
	<div class="center" style="left: {x * 100}%; top: {y * 100}%" on:pointerdown={onPointerDown} />
</div>

<style>
	.crosshair-overlay {
		position: absolute;
		z-index: 10;
		inset: 0;
		pointer-events: none;
	}

	.line {
		position: absolute;
		pointer-events: none;
	}

	.vertical {
		top: 0;
		bottom: 0;
		width: 2px;
		background: repeating-linear-gradient(
			to bottom,
			green 0,
			green 4px,
			transparent 4px,
			transparent 8px
		);
	}

	.horizontal {
		left: 0;
		right: 0;
		height: 2px;
		background: repeating-linear-gradient(
			to right,
			green 0,
			green 4px,
			transparent 4px,
			transparent 8px
		);
	}

	.center {
		position: absolute;
		width: 14px;
		height: 14px;
		background: #10b981;
		border: 2px solid white;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		cursor: move;
		pointer-events: auto; /* critical */
		box-shadow: 0 0 6px rgba(0, 0, 0, 0.3);
	}
</style>
