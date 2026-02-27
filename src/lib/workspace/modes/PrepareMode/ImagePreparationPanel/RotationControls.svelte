<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let rotation = 0;

	const dispatch = createEventDispatcher();

	function onInput(e: Event) {
		const value = Number((e.target as HTMLInputElement).value);
		dispatch('change', value);
	}
</script>

<div class="rotation-controls">
	<input
		class="slider"
		type="range"
		min="-10"
		max="10"
		step="0.01"
		value={rotation}
		on:input={onInput}
	/>

	<span class="angle">{rotation.toFixed(2)}°</span>
</div>

<style>
	.rotation-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1rem 0;
	}

	.slider {
		width: 400px; /* MUCH wider */
		max-width: 70vw;
		cursor: pointer;
	}

	.angle {
		font-variant-numeric: tabular-nums;
		min-width: 60px;
		text-align: right;
		color: #374151;
	}
</style>
