<script lang="ts">
	import FilenameGroupingTool from './tools/FilenameGroupingTool.svelte';
	import PHashGroupingTool from './tools/PHashGroupingTool.svelte';
	import VisualProfileTool from './tools/VisualProfileTool.svelte';

	let tool: 'filename' | 'phash' | 'visual-profile' = 'filename';
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
