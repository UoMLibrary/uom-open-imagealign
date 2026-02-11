<script lang="ts">
	import { images } from '$lib/domain/project/projectStore';
	import { groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../GroupProposalList.svelte';
	import { groupByFilename } from '$lib/strategies/grouping/byFilename';

	$: {
		const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

		const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

		const proposals = groupByFilename(eligibleImages);

		groupingState.set({
			proposals,
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<p class="description">Group images based on shared filename patterns.</p>

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
</style>
