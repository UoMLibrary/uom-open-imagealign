<script lang="ts">
	import { images, groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import { groupByFilename } from '$lib/strategies/grouping/byFilename';
	import { get } from 'svelte/store';

	let running = false;
	let cancelled = false;

	async function run() {
		if (running) return;

		running = true;
		cancelled = false;

		try {
			const $images = get(images);
			const $groups = get(groups);

			const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

			const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

			if (cancelled) return;

			const proposals = groupByFilename(eligibleImages);

			if (cancelled) return;

			groupingState.set({
				proposals,
				selected: new Set()
			});
		} finally {
			running = false;
		}
	}

	// Allow parent panel to cancel if tool is switched
	export function cancel() {
		cancelled = true;
	}
</script>

<div class="tool">
	<div class="tool-header">
		<p class="description">Group images based on shared filename patterns.</p>

		<button class="run-button" on:click={run} disabled={running}>
			{running ? 'Running…' : 'Run grouping strategy'}
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
