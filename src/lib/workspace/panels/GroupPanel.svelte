<script lang="ts">
	import { onMount } from 'svelte';
	import FilenameGroupingTool from '../../features/grouping/tools/FilenameGroupingTool.svelte';
	import PHashGroupingTool from '../../features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '../../features/grouping/tools/VisualProfileTool.svelte';
	import LeafFolderGroupingTool from '$lib/features/grouping/tools/LeafFolderGroupingTool.svelte';

	import { groupingState } from '$lib/domain/grouping/groupingStore';

	type GroupingTool = 'filename' | 'phash' | 'visual-profile' | 'leaf-folder';
	let tool: GroupingTool = 'filename';

	// Switching grouping tools should reset proposals and selection
	// let previousTool: GroupingTool | null = null;
	// $: {
	// 	if (tool !== previousTool) {
	// 		groupingState.set({
	// 			proposals: [],
	// 			selected: new Set()
	// 		});
	// 		previousTool = tool;
	// 	}
	// }

	function handleToolChange() {
		groupingState.set({
			proposals: [],
			selected: new Set()
		});
	}

	onMount(() => {
		console.log('GroupPanel mounted');
	});
</script>

<div class="group-panel">
	<header class="controls">
		<select bind:value={tool} on:change={handleToolChange}>
			<option value="filename">Group by filename</option>
			<option value="phash">Group by visual similarity (pHash)</option>
			<option value="visual-profile">Group by visual profile (colour & tone)</option>
			<option value="leaf-folder">Group by leaf folder</option>
		</select>
	</header>

	{#if tool === 'filename'}
		<FilenameGroupingTool />
	{:else if tool === 'phash'}
		<PHashGroupingTool />
	{:else if tool === 'visual-profile'}
		<VisualProfileTool />
	{:else if tool === 'leaf-folder'}
		<LeafFolderGroupingTool />
	{/if}
</div>
