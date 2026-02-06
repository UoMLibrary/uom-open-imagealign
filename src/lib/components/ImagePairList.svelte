<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import ImagePairItem from './ImagePairItem.svelte';

	export let imagePairs = [];
	export let selectedId = null;

	const dispatch = createEventDispatcher();
</script>

<div class="pair-list">
	{#each imagePairs as pair}
		<ImagePairItem
			{pair}
			selected={pair.id === selectedId}
			on:select={() => dispatch('select', pair)}
		/>
	{/each}
</div>

<style>
	.pair-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		padding: 6px;
		overflow-y: auto;

		width: 100%;
	}
</style>
