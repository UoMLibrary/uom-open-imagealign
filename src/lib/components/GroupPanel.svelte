<script lang="ts">
	import { images } from '$lib/stores/projectStore';
	import { groupingState } from '$lib/stores/groupingStore';
	import GroupProposalList from './GroupProposalList.svelte';
	import { groupByFilename } from '$lib/strategies/grouping/byFilename';
	import { groupByPHash } from '$lib/strategies/grouping/byPHash';

	let strategy: 'filename' | 'phash' = 'filename';
	let phashThreshold = 0.95;

	function runGrouping() {
		let proposals = [];

		if (strategy === 'filename') {
			proposals = groupByFilename($images);
		}

		if (strategy === 'phash') {
			proposals = groupByPHash($images, phashThreshold);
		}

		groupingState.set({
			proposals,
			selected: new Set()
		});
	}
</script>

<div class="group-panel">
	<header class="controls">
		<select bind:value={strategy}>
			<option value="filename">Group by filename</option>
			<option value="phash">Group by visual similarity (pHash)</option>
		</select>

		{#if strategy === 'phash'}
			<label class="slider">
				Similarity: {Math.round(phashThreshold * 100)}%
				<input
					type="range"
					min="0.2"
					max="1"
					step="0.01"
					bind:value={phashThreshold}
					on:input={runGrouping}
				/>
			</label>
		{/if}

		<button on:click={runGrouping}> Propose groups </button>
	</header>

	<GroupProposalList />
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-bottom: 1px solid #ddd;
	}

	.slider {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
</style>
