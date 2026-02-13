<script lang="ts">
	import FilenameGroupingTool from '../../features/grouping/tools/FilenameGroupingTool.svelte';
	import PHashGroupingTool from '../../features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '../../features/grouping/tools/VisualProfileTool.svelte';

	import { groupingState } from '$lib/domain/grouping/groupingStore';

	type GroupingTool = 'filename' | 'phash' | 'visual-profile';
	let tool: GroupingTool = 'filename';

	// Switching grouping tools should reset proposals and selection
	let previousTool: GroupingTool | null = null;
	$: {
		if (tool !== previousTool) {
			groupingState.set({
				proposals: [],
				selected: new Set()
			});
			previousTool = tool;
		}
	}
</script>

<div class="group-panel">
	<header class="controls">
		<select bind:value={tool}>
			<option value="filename">Group by filename</option>
			<option value="phash">Group by visual similarity (pHash)</option>
			<option value="visual-profile">Group by visual profile (colour & tone)</option>
		</select>
	</header>

	{#if tool === 'filename'}
		<FilenameGroupingTool />
	{:else if tool === 'phash'}
		<PHashGroupingTool />
	{:else if tool === 'visual-profile'}
		<VisualProfileTool />
	{/if}
</div>
