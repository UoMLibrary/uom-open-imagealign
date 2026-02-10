<script lang="ts">
	import { images } from '$lib/stores/projectStore';
	import { groupingState } from '$lib/stores/groupingStore';
	import GroupProposalList from '../GroupProposalList.svelte';
	import { groupByPHash } from '$lib/strategies/grouping/byPHash';

	let threshold = 0.95;

	function run() {
		groupingState.set({
			proposals: groupByPHash($images, threshold),
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<label>
		Similarity: {Math.round(threshold * 100)}%
		<input type="range" min="0.2" max="1" step="0.01" bind:value={threshold} on:input={run} />
	</label>

	<button on:click={run}>Propose groups</button>

	<GroupProposalList />
</div>
