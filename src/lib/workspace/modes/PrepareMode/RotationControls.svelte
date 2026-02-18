<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let rotation = 0;

	const dispatch = createEventDispatcher();

	function onInput(e) {
		dispatch('change', Number(e.target.value));
	}
</script>

<div class="rotation-controls">
	<input type="range" min="-10" max="10" step="0.1" value={rotation} on:input={onInput} />
	<span>{rotation.toFixed(1)}°</span>
</div>

<style>
	.rotation-controls {
		margin-top: 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
	}
</style>
