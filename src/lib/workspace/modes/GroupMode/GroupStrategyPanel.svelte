<script lang="ts">
	import FilenameGroupingTool from '$lib/features/grouping/tools/FilenameGroupingTool.svelte';
	import LeafFolderGroupingTool from '$lib/features/grouping/tools/LeafFolderGroupingTool.svelte';
	import PHashGroupingTool from '$lib/features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '$lib/features/grouping/tools/VisualProfileTool.svelte';
	import PanelHeader from '$lib/shared/ui/PanelHeader.svelte';

	let selectedStrategy = 'filename';
</script>

<section>
	<PanelHeader inline>
		<h2 class="panel-title">Grouping Strategy</h2>
	</PanelHeader>

	<select bind:value={selectedStrategy}>
		<option value="filename">By Filename</option>
		<option value="leaf">By Leaf Folder</option>
		<option value="phash">By pHash</option>
		<option value="visual">By Visual Profile</option>
	</select>

	{#if selectedStrategy === 'filename'}
		<FilenameGroupingTool />
	{:else if selectedStrategy === 'leaf'}
		<LeafFolderGroupingTool />
	{:else if selectedStrategy === 'phash'}
		<PHashGroupingTool />
	{:else if selectedStrategy === 'visual'}
		<VisualProfileTool />
	{/if}
</section>
