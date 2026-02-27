<script lang="ts">
	import IndividualGroupingTool from '$lib/ui/features/grouping/tools/IndividualGroupingTool.svelte';
	import FilenameGroupingTool from '$lib/ui/features/grouping/tools/FilenameGroupingTool.svelte';
	import LeafFolderGroupingTool from '$lib/ui/features/grouping/tools/LeafFolderGroupingTool.svelte';
	import PHashGroupingTool from '$lib/ui/features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '$lib/ui/features/grouping/tools/VisualProfileTool.svelte';

	let selectedStrategy = 'individual';
</script>

<section>
	<h3 class="panel-title">Grouping Strategy</h3>

	<select bind:value={selectedStrategy}>
		<option value="individual">Individual Images</option>
		<option value="filename">By Filename</option>
		<option value="leaf">By Leaf Folder</option>
		<option value="phash">By pHash</option>
		<option value="visual">By Visual Profile</option>
	</select>

	{#if selectedStrategy === 'individual'}
		<IndividualGroupingTool />
	{:else if selectedStrategy === 'filename'}
		<FilenameGroupingTool />
	{:else if selectedStrategy === 'leaf'}
		<LeafFolderGroupingTool />
	{:else if selectedStrategy === 'phash'}
		<PHashGroupingTool />
	{:else if selectedStrategy === 'visual'}
		<VisualProfileTool />
	{/if}
</section>
