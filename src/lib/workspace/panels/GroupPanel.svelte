<script lang="ts">
	import { groupingState } from '$lib/domain/grouping/groupingStore';

	import FilenameGroupingTool from '../../features/grouping/tools/FilenameGroupingTool.svelte';
	import PHashGroupingTool from '../../features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '../../features/grouping/tools/VisualProfileTool.svelte';
	import LeafFolderGroupingTool from '../../features/grouping/tools/LeafFolderGroupingTool.svelte';

	import GroupProposalList from './GroupProposalList.svelte';
	import { ungroupedImageIds } from '$lib/features/thumbnails/imageVisibility';
	import PanelHeader from '$lib/shared/ui/PanelHeader.svelte';

	type GroupingTool = 'filename' | 'phash' | 'visual-profile' | 'leaf-folder';

	let tool: GroupingTool = 'filename';

	let toolRef: any = null;
	let previousToolRef: any = null;

	/* -----------------------------
	   When tool component changes:
	   - cancel previous tool
	   - clear proposals
	----------------------------- */
	$: if (toolRef !== previousToolRef) {
		previousToolRef?.cancel?.();

		groupingState.set({
			proposals: [],
			selected: new Set()
		});

		previousToolRef = toolRef;
	}
</script>

<div class="group-panel">
	<PanelHeader inline={true}>
		<h2 class="panel-title">Grouping Strategy</h2>
		<select bind:value={tool}>
			<option value="filename">Filename</option>
			<option value="phash">Visual similarity (pHash)</option>
			<option value="visual-profile">Visual profile (colour & tone)</option>
			<option value="leaf-folder">Leaf folder</option>
		</select>
	</PanelHeader>

	<section class="tool-body">
		{#if tool === 'filename'}
			<FilenameGroupingTool bind:this={toolRef} />
		{:else if tool === 'phash'}
			<PHashGroupingTool bind:this={toolRef} />
		{:else if tool === 'visual-profile'}
			<VisualProfileTool bind:this={toolRef} />
		{:else if tool === 'leaf-folder'}
			<LeafFolderGroupingTool bind:this={toolRef} />
		{/if}
	</section>

	<GroupProposalList />
</div>

<style>
	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #444;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		user-select: none;
	}
</style>
