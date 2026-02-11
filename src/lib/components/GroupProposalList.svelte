<script lang="ts">
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import ImageThumbnailGrid from '$lib/components/ImageThumbnailGrid.svelte';
	import type { GroupingProposal } from '$lib/domain/grouping/types';
	import { addGroups } from '$lib/domain/project/projectStore';
	import type { ImageGroup } from '$lib/types/project';

	// 🔑 Explicitly typed locals (this fixes the `never` issue)
	let proposals: GroupingProposal[] = [];
	let selected: Set<string> = new Set();

	function toggle(id: string) {
		groupingState.update((state) => {
			const selected = new Set(state.selected);
			selected.has(id) ? selected.delete(id) : selected.add(id);
			return { ...state, selected };
		});
	}

	function selectAll() {
		groupingState.update((state) => ({
			...state,
			selected: new Set(state.proposals.map((p) => p.id))
		}));
	}

	function clearAll() {
		groupingState.update((state) => ({
			...state,
			selected: new Set()
		}));
	}

	function confirmSelected() {
		const confirmed: ImageGroup[] = proposals
			.filter((p) => selected.has(p.id))
			.map((p) => {
				const [first, second, ...rest] = p.imageIds;

				// Defensive guard (keeps TS + runtime happy)
				if (!first || !second) {
					throw new Error('Cannot create group with fewer than 2 images');
				}

				return {
					id: crypto.randomUUID(),
					baseImageId: first,
					imageIds: [first, second, ...rest],
					locked: false
				};
			});

		if (confirmed.length === 0) return;

		addGroups(confirmed);

		groupingState.set({
			proposals: [],
			selected: new Set()
		});
	}

	// Reactive assignments (now safely typed)
	$: proposals = $groupingState.proposals;
	$: selected = $groupingState.selected;
</script>

<div class="group-proposal-list">
	{#if proposals.length === 0}
		<p class="empty">No grouping proposals. Try running a different strategy.</p>
	{:else}
		<div class="controls">
			<button on:click={selectAll}>Select all</button>
			<button on:click={clearAll}>Clear</button>

			<button on:click={confirmSelected} disabled={selected.size === 0}> Confirm selected </button>

			<span class="count">
				{selected.size} / {proposals.length} selected
			</span>
		</div>

		{#each proposals as proposal (proposal.id)}
			<div class="proposal">
				<label class="header">
					<input
						type="checkbox"
						checked={selected.has(proposal.id)}
						on:change={() => toggle(proposal.id)}
					/>
					<span class="title">
						Group of {proposal.imageIds.length} images
					</span>
					{#if proposal.confidence !== undefined}
						<span class="confidence">
							{Math.round(proposal.confidence * 100)}%
						</span>
					{/if}
				</label>

				{#if proposal.reason}
					<div class="reason">
						{proposal.reason}
					</div>
				{/if}

				<ImageThumbnailGrid visibleImageIds={proposal.imageIds} />
			</div>
		{/each}
	{/if}
</div>

<style>
	.group-proposal-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.controls button {
		padding: 0.25rem 0.5rem;
	}

	.count {
		margin-left: auto;
		opacity: 0.7;
	}

	.proposal {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 0.75rem;
		background: #fafafa;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.title {
		flex: 1;
	}

	.confidence {
		font-size: 0.85rem;
		opacity: 0.8;
	}

	.reason {
		font-size: 0.85rem;
		margin: 0.25rem 0 0.5rem;
		opacity: 0.75;
	}

	.empty {
		font-style: italic;
		opacity: 0.7;
	}
</style>
