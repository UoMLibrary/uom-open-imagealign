<script lang="ts">
	import { images, groups } from '$lib/core/projectStore';
	import { groupingState } from '$lib/core/groupingStore';
	import { groupByIndividual } from '$lib/services/grouping';
	import { get } from 'svelte/store';

	let running = false;

	async function run() {
		if (running) return;

		running = true;

		try {
			const $images = get(images);
			const $groups = get(groups);

			const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

			const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

			const proposals = groupByIndividual(eligibleImages);

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
	<div class="tool-header">
		<p class="description">Create a separate group for each individual image.</p>

		<button class="run-button" on:click={run} disabled={running}>
			{running ? 'Running…' : 'Create individual groups'}
		</button>
	</div>

	{#if running}
		<p class="status">Generating proposals…</p>
	{/if}
</div>

<style>
	.tool {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tool-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.description {
		font-size: 0.85rem;
		color: #555;
		margin: 0;
	}

	.run-button {
		padding: 0.4rem 0.9rem;
		border-radius: 6px;
		border: none;
		background: #2d6cdf;
		color: white;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.run-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.status {
		font-size: 0.8rem;
		color: #888;
		font-style: italic;
	}
</style>
