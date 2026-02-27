<script lang="ts" context="module">
	import type { ImageAlignment } from '$lib/core/types';

	export type AlignmentDraft = {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	};
</script>

<script lang="ts">
	export let targetUrl: string;
	export let sourceUrl: string;

	export let existingAlignment: ImageAlignment | null = null;

	// Svelte 5 callback prop
	export let onSave: (draft: AlignmentDraft) => void;

	function saveIdentity() {
		onSave?.({
			confidence: 1,
			transform: {
				type: 'homography',
				matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
			},
			methodData: {
				note: 'Manual tool scaffold (identity)'
			}
		});
	}
</script>

<div class="tool">
	<div class="tool-header">
		<div class="name">Manual alignment</div>
		<button class="save" type="button" on:click={saveIdentity}>Save alignment</button>
	</div>

	<div class="content">
		<div class="pane">
			<div class="pane-title">Target (base)</div>
			<img src={targetUrl} alt="Target image" />
		</div>

		<div class="pane">
			<div class="pane-title">Source (to align)</div>
			<img src={sourceUrl} alt="Source image" />
		</div>
	</div>

	{#if existingAlignment}
		<details class="debug">
			<summary>Existing alignment (debug)</summary>
			<pre>{JSON.stringify(existingAlignment, null, 2)}</pre>
		</details>
	{/if}
</div>

<style>
	.tool {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tool-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.name {
		font-weight: 700;
		color: #111827;
		font-size: 0.9rem;
	}

	.save {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: #d1fae5;
		color: #065f46;
		font-weight: 700;
	}

	.save:hover {
		background: #a7f3d0;
	}

	.content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		min-height: 0;
	}

	.pane {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 10px;
		background: white;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pane-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #f3f4f6;
	}

	.debug {
		font-size: 0.8rem;
		color: #334155;
	}

	.debug pre {
		margin: 0.5rem 0 0;
		background: rgba(0, 0, 0, 0.04);
		padding: 0.5rem;
		border-radius: 8px;
		overflow: auto;
		max-height: 220px;
	}
</style>
