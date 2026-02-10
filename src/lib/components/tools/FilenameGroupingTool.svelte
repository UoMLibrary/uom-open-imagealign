<script lang="ts">
	import { images } from '$lib/stores/projectStore';
	import { groupingState } from '$lib/stores/groupingStore';
	import GroupProposalList from '../GroupProposalList.svelte';
	import { groupByFilename } from '$lib/strategies/grouping/byFilename';

	function run() {
		groupingState.set({
			proposals: groupByFilename($images),
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<p class="description">Group images based on shared filename patterns.</p>

	<button on:click={run}> Propose groups </button>

	<GroupProposalList />
</div>

<style>
	.tool {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.description {
		font-size: 0.85rem;
		color: #555;
	}

	button {
		align-self: flex-start;
	}
</style>
