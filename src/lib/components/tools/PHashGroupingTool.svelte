<script lang="ts">
	import { images, groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../GroupProposalList.svelte';
	import { groupByPHash } from '$lib/strategies/grouping/byPHash';

	let threshold = 0.95;

	// Automatically recompute proposals when:
	// - images change
	// - threshold changes
	// - grouped/proposed state changes (via ungroupedImageIds)
	$: {
		const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

		const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

		const proposals = groupByPHash(eligibleImages, threshold);

		groupingState.set({
			proposals,
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<p class="description">Group images based on perceptual hash (pHash) similarity.</p>

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

	.description {
		font-size: 0.85rem;
		color: #555;
	}
</style>
