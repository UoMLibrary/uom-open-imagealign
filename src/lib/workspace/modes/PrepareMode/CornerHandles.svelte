<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let corners;

	const dispatch = createEventDispatcher();

	let draggingIndex = null;

	function onPointerDown(index) {
		draggingIndex = index;
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	}

	function onPointerMove(e) {
		if (draggingIndex === null) return;

		const rect = e.target.closest('.overlay').getBoundingClientRect();

		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;

		corners[draggingIndex] = { x, y };
		dispatch('change', [...corners]);
	}

	function onPointerUp() {
		draggingIndex = null;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
	}
</script>

<div class="overlay">
	{#each corners as corner, i}
		<div
			class="handle"
			style="left: {corner.x * 100}%; top: {corner.y * 100}%;"
			on:pointerdown={() => onPointerDown(i)}
		/>
	{/each}
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
	}

	.handle {
		position: absolute;
		width: 12px;
		height: 12px;
		background: #111827;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		cursor: grab;
	}
</style>
