<script lang="ts">
	import { images } from '$lib/stores/projectStore';
	import { groupingState } from '$lib/stores/groupingStore';
	import GroupProposalList from './GroupProposalList.svelte';
	import { groupByFilename } from '$lib/strategies/grouping/byFilename';

	function runFilenameGrouping() {
		const proposals = groupByFilename($images);

		groupingState.set({
			proposals,
			selected: new Set()
		});
	}
</script>

<div class="group-panel">
	<header class="controls">
		<button on:click={runFilenameGrouping}> Group by filename </button>
	</header>

	<GroupProposalList />
</div>

<style>
	.group-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.controls {
		padding: 0.75rem;
		border-bottom: 1px solid #ddd;
	}
</style>
