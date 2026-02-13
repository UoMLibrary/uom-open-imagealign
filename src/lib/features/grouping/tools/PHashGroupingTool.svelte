<script lang="ts">
	import { images, groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../../../workspace/panels/GroupProposalList.svelte';
	import { groupByPHash } from '$lib/strategies/grouping/byPHash';
	import { get } from 'svelte/store';

	let threshold = 0.95;
	let running = false;
	let cancelled = false;

	/* ----------------------------------
	   Explicit execution (Run button)
	----------------------------------- */
	export async function run() {
		if (running) return;

		running = true;
		cancelled = false;

		try {
			const $images = get(images);
			const $groups = get(groups);

			const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

			const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

			if (cancelled) return;

			const proposals = groupByPHash(eligibleImages, threshold);

			if (cancelled) return;

			groupingState.set({
				proposals,
				selected: new Set()
			});
		} finally {
			running = false;
		}
	}

	/* ----------------------------------
	   Allow parent to cancel
	----------------------------------- */
	export function cancel() {
		cancelled = true;
	}

	/* ----------------------------------
	   Run when slider released
	----------------------------------- */
	async function handleSliderChange() {
		cancel();
		await run();
	}
</script>

<div class="tool">
	<p class="description">Group images based on perceptual hash (pHash) similarity.</p>

	<label class="slider">
		Similarity: {Math.round(threshold * 100)}%
		<input
			type="range"
			min="0.2"
			max="1"
			step="0.01"
			bind:value={threshold}
			on:change={handleSliderChange}
		/>
	</label>

	{#if running}
		<p class="status">Computing similarity…</p>
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

	.slider {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: #555;
	}

	.status {
		font-size: 0.8rem;
		color: #888;
		font-style: italic;
	}
</style>
