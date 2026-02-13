<script lang="ts">
	import { images, groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../../../workspace/panels/GroupProposalList.svelte';
	import { groupByLeafFolder } from '$lib/strategies/grouping/byLeafFolder';

	$: {
		const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

		const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

		const proposals = groupByLeafFolder(eligibleImages);

		groupingState.set({
			proposals,
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<p class="description">Group images found together in leaf folders.</p>

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
