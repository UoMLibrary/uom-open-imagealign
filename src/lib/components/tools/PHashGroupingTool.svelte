<script lang="ts">
	import { images } from '$lib/stores/projectStore';
	import { groupingState } from '$lib/stores/groupingStore';
	import GroupProposalList from '../GroupProposalList.svelte';
	import { groupByPHash } from '$lib/strategies/grouping/byPHash';

	let threshold = 0.95;

	// Automatically recompute proposals when:
	// - images change
	// - threshold changes
	$: {
		const proposals = groupByPHash($images, threshold);

		groupingState.set({
			proposals,
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<label class="slider">
		Similarity: {Math.round(threshold * 100)}%
		<input type="range" min="0.2" max="1" step="0.01" bind:value={threshold} />
	</label>

	<GroupProposalList />
</div>

<style>
	.tool {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.slider {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: #555;
	}
</style>
