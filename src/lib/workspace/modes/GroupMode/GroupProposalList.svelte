<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import { images } from '$lib/domain/project/projectStore';
	import type { GroupingProposal } from '$lib/domain/grouping/types';
	import ImageThumbnail from '$lib/features/thumbnails/ImageThumbnail.svelte';

	const dispatch = createEventDispatcher<{
		confirm: GroupingProposal;
		discard: string;
	}>();

	// Sort proposals largest first
	$: sorted = [...$groupingState.proposals].sort((a, b) => b.imageIds.length - a.imageIds.length);

	// Image lookup map
	$: imagesById = Object.fromEntries($images.map((img) => [img.id, img]));
</script>

{#if sorted.length === 0}
	<div class="empty">No group suggestions</div>
{:else}
	<div class="proposal-list">
		{#each sorted as proposal (proposal.id)}
			<div class="proposal-card">
				<div class="proposal-header">
					<div class="proposal-title">
						Proposed Group ({proposal.imageIds.length})
					</div>

					{#if proposal.confidence != null}
						<div class="confidence">
							{Math.round(proposal.confidence * 100)}%
						</div>
					{/if}
				</div>

				{#if proposal.reason}
					<div class="reason">{proposal.reason}</div>
				{/if}

				<div class="proposal-images">
					{#each proposal.imageIds as id}
						{#if imagesById[id]}
							<ImageThumbnail
								contentHash={imagesById[id].hashes.contentHash}
								fallbackSrc={imagesById[id].uri}
								label={imagesById[id].label}
								mode="thumb"
								debugCompare={true}
							/>
						{/if}
					{/each}
				</div>

				<div class="proposal-actions">
					<button class="confirm" on:click={() => dispatch('confirm', proposal)}> Confirm </button>

					<button class="discard" on:click={() => dispatch('discard', proposal.id)}>
						Discard
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.proposal-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.proposal-card {
		border: 1px dashed #cbd5e1;
		border-radius: 8px;
		padding: 0.75rem;
		background: #f8fafc;
	}

	.proposal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.proposal-title {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.confidence {
		font-size: 0.7rem;
		color: #64748b;
		background: #e2e8f0;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
	}

	.reason {
		font-size: 0.75rem;
		color: #475569;
		margin-bottom: 0.5rem;
	}

	.proposal-images {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.image-pill {
		font-size: 0.7rem;
		padding: 0.2rem 0.4rem;
		background: #e2e8f0;
		border-radius: 4px;
	}

	.proposal-actions {
		display: flex;
		gap: 0.5rem;
	}

	button {
		all: unset;
		cursor: pointer;
		padding: 0.3rem 0.6rem;
		font-size: 0.75rem;
		border-radius: 4px;
	}

	.confirm {
		background: #d1fae5;
		color: #065f46;
	}

	.confirm:hover {
		background: #a7f3d0;
	}

	.discard {
		background: #f1f5f9;
		color: #334155;
	}

	.discard:hover {
		background: #e2e8f0;
	}

	.empty {
		padding: 0.75rem;
		font-size: 0.75rem;
		color: #6b7280;
	}
</style>
