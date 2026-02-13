<script lang="ts">
	import { images } from '$lib/domain/project/projectStore';
	import { groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../../../workspace/panels/GroupProposalList.svelte';
	import { groupByFilename } from '$lib/strategies/grouping/byFilename';
	import { get } from 'svelte/store';

	let running = false;

	export async function run() {
		running = true;

		// Inside a run() function we cannot rely on reactive $store values.
		// We need to pull the current snapshot manually.
		try {
			const $images = get(images);
			const $groups = get(groups);

			const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

			const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

			const proposals = groupByFilename(eligibleImages);

			groupingState.set({
				proposals,
				selected: new Set()
			});
		} finally {
			running = false;
		}
	}
</script>

<div class="tool">
	<p class="description">Group images based on shared filename patterns.</p>

	{#if running}
		<p class="status">Generating proposals…</p>
	{/if}

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

	.status {
		font-size: 0.8rem;
		color: #888;
		font-style: italic;
	}
</style>
