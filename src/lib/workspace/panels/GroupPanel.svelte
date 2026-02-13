<script lang="ts">
	import { groupingState } from '$lib/domain/grouping/groupingStore';

	import FilenameGroupingTool from '../../features/grouping/tools/FilenameGroupingTool.svelte';
	import PHashGroupingTool from '../../features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '../../features/grouping/tools/VisualProfileTool.svelte';
	import LeafFolderGroupingTool from '../../features/grouping/tools/LeafFolderGroupingTool.svelte';

	type GroupingTool = 'filename' | 'phash' | 'visual-profile' | 'leaf-folder';

	let tool: GroupingTool = 'filename';

	let toolRef: any = null;
	let previousToolRef: any = null;
	let running = false;

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

	async function runTool() {
		if (!toolRef?.run || running) return;

		running = true;

		try {
			await toolRef.run();
		} finally {
			running = false;
		}
	}
</script>

<div class="group-panel">
	<header class="controls">
		<div class="tool-select">
			<label>Grouping strategy</label>
			<select bind:value={tool} disabled={running}>
				<option value="filename">Filename</option>
				<option value="phash">Visual similarity (pHash)</option>
				<option value="visual-profile">Visual profile (colour & tone)</option>
				<option value="leaf-folder">Leaf folder</option>
			</select>
		</div>

		<button class="run-button" on:click={runTool} disabled={running}>
			{running ? 'Running…' : 'Run grouping'}
		</button>
	</header>

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
</div>

<style>
	.group-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--panel-bg, #f5f5f5);
		border-radius: 8px;
	}

	.tool-select {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	select {
		padding: 0.4rem 0.6rem;
		border-radius: 6px;
		border: 1px solid #ccc;
	}

	.run-button {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: none;
		background: #2d6cdf;
		color: white;
		cursor: pointer;
		font-weight: 500;
	}

	.run-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tool-body {
		padding: 0.75rem;
		border: 1px solid #eee;
		border-radius: 8px;
		background: white;
	}
</style>
