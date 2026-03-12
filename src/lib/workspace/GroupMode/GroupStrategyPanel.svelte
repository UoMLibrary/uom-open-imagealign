<script lang="ts">
	import IndividualGroupingTool from '$lib/ui/features/grouping/tools/IndividualGroupingTool.svelte';
	import FilenameGroupingTool from '$lib/ui/features/grouping/tools/FilenameGroupingTool.svelte';
	import LeafFolderGroupingTool from '$lib/ui/features/grouping/tools/LeafFolderGroupingTool.svelte';
	import PHashGroupingTool from '$lib/ui/features/grouping/tools/PHashGroupingTool.svelte';
	import VisualProfileTool from '$lib/ui/features/grouping/tools/VisualProfileTool.svelte';

	type StrategyKey = 'individual' | 'filename' | 'leaf' | 'phash' | 'visual';

	let selectedStrategy: StrategyKey = 'leaf';

	const strategies = [
		{
			key: 'leaf',
			label: 'Leaf folder',
			description: 'Suggest groups from the leaf folder structure.',
			component: LeafFolderGroupingTool
		},
		{
			key: 'filename',
			label: 'Filename',
			description: 'Use filename patterns and naming similarity.',
			component: FilenameGroupingTool
		},
		{
			key: 'phash',
			label: 'pHash',
			description: 'Find visually similar images using perceptual hashing.',
			component: PHashGroupingTool
		},
		{
			key: 'visual',
			label: 'Visual profile',
			description: 'Compare broader visual characteristics.',
			component: VisualProfileTool
		},
		{
			key: 'individual',
			label: 'Single images',
			description: 'Create one-image proposals for manual grouping.',
			component: IndividualGroupingTool
		}
	] as const;

	$: selectedDefinition =
		strategies.find((strategy) => strategy.key === selectedStrategy) ?? strategies[0];
</script>

<section class="strategy-panel">
	<div class="panel-header">
		<div>
			<div class="eyebrow">Grouping tools</div>
			<h2 class="panel-title">Choose a grouping strategy</h2>
			<p class="panel-copy">
				Generate suggestions from different signals, then review and edit groups in the workspace.
			</p>
		</div>
	</div>

	<div class="strategy-grid" role="tablist" aria-label="Grouping strategies">
		{#each strategies as strategy}
			<button
				type="button"
				role="tab"
				class:selected={selectedStrategy === strategy.key}
				class="strategy-card"
				aria-selected={selectedStrategy === strategy.key}
				on:click={() => (selectedStrategy = strategy.key)}
			>
				<div class="strategy-card-top">
					<div class="strategy-label">{strategy.label}</div>
					{#if selectedStrategy === strategy.key}
						<div class="active-dot" aria-hidden="true"></div>
					{/if}
				</div>

				<div class="strategy-description">
					{strategy.description}
				</div>
			</button>
		{/each}
	</div>

	<div class="tool-shell">
		<div class="tool-header">
			<div>
				<div class="tool-title">{selectedDefinition.label}</div>
				<div class="tool-copy">{selectedDefinition.description}</div>
			</div>
		</div>

		<div class="tool-body">
			<svelte:component this={selectedDefinition.component} />
		</div>
	</div>
</section>

<style>
	.strategy-panel {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.panel-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		margin-bottom: 0.35rem;
	}

	.panel-title {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.2;
		font-weight: 700;
		color: #111827;
	}

	.panel-copy {
		margin: 0.35rem 0 0 0;
		font-size: 0.92rem;
		line-height: 1.45;
		color: #6b7280;
		max-width: 60ch;
	}

	.strategy-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.strategy-card {
		text-align: left;
		padding: 0.9rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.9rem;
		background: #ffffff;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease,
			transform 120ms ease,
			background 120ms ease;
	}

	.strategy-card:hover {
		border-color: #cfd8e3;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
		transform: translateY(-1px);
	}

	.strategy-card:focus-visible {
		outline: none;
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
	}

	.strategy-card.selected {
		border-color: #60a5fa;
		background: #f8fbff;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.strategy-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.45rem;
	}

	.strategy-label {
		font-size: 0.95rem;
		font-weight: 600;
		color: #111827;
		line-height: 1.25;
	}

	.strategy-description {
		font-size: 0.83rem;
		line-height: 1.4;
		color: #6b7280;
	}

	.active-dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 999px;
		background: #2563eb;
		flex: 0 0 auto;
		box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
	}

	.tool-shell {
		border: 1px solid #e5e7eb;
		border-radius: 1rem;
		background: #ffffff;
		overflow: hidden;
	}

	.tool-header {
		padding: 0.9rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		background: linear-gradient(to bottom, #fcfcfd, #f9fafb);
	}

	.tool-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #111827;
		line-height: 1.2;
	}

	.tool-copy {
		margin-top: 0.2rem;
		font-size: 0.84rem;
		line-height: 1.4;
		color: #6b7280;
	}

	.tool-body {
		padding: 1rem;
	}

	@media (max-width: 720px) {
		.strategy-grid {
			grid-template-columns: 1fr;
		}

		.panel-title {
			font-size: 1rem;
		}
	}
</style>
