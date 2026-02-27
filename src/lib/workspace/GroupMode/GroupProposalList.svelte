<script lang="ts">
	import {
		groupingState,
		ungroupImageFromProposal,
		discardProposal,
		confirmProposalAsGroup
	} from '$lib/core/groupingStore';
	import { imagesById } from '$lib/core/projectStore';
	import type { GroupingProposal } from '$lib/core/groupingStore';

	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';

	// Svelte 5 callback props (optional; store fallbacks provided)
	export let onConfirmGroup: ((proposal: GroupingProposal) => void) | undefined;
	export let onDiscardProposal: ((proposalId: string) => void) | undefined;
	export let onUngroupImage: ((proposalId: string, imageId: string) => void) | undefined;

	// Back-compat aliases (if you’re still using the old prop names somewhere)
	export let onConfirm: ((proposal: GroupingProposal) => void) | undefined;
	export let onDiscard: ((proposalId: string) => void) | undefined;

	$: proposals = $groupingState.proposals;

	// Sort proposals largest first
	$: sorted = [...proposals].sort((a, b) => b.imageIds.length - a.imageIds.length);

	function handleConfirm(proposal: GroupingProposal) {
		// Prefer new prop, then legacy prop, then store helper
		(onConfirmGroup ?? onConfirm)?.(proposal) ?? confirmProposalAsGroup(proposal.id);
	}

	function handleDiscard(proposalId: string) {
		(onDiscardProposal ?? onDiscard)?.(proposalId) ?? discardProposal(proposalId);
	}

	function handleUngroup(proposalId: string, imageId: string) {
		onUngroupImage?.(proposalId, imageId) ?? ungroupImageFromProposal(proposalId, imageId);
	}
</script>

{#if sorted.length === 0}
	<div class="empty">No group suggestions</div>
{:else}
	<div class="proposal-list">
		{#each sorted as proposal (proposal.id)}
			<div class="proposal-card">
				<div class="proposal-header">
					<div class="meta">
						<div class="count">{proposal.imageIds.length} images</div>

						{#if proposal.confidence != null}
							<div class="confidence">{Math.round(proposal.confidence * 100)}%</div>
						{/if}
					</div>

					<button class="icon-btn" type="button" on:click={() => handleDiscard(proposal.id)}>
						Discard
					</button>
				</div>

				{#if proposal.reason}
					<div class="reason">{proposal.reason}</div>
				{/if}

				<div class="proposal-images">
					{#each proposal.imageIds as id (id)}
						{#if $imagesById[id]}
							<div class="thumb">
								<ImageThumbnail
									contentHash={$imagesById[id].hashes?.contentHash}
									fallbackSrc={$imagesById[id].runtimeUri}
									label={$imagesById[id].label}
									mode="normalised"
								/>

								{#if proposal.imageIds.length > 1}
									<button
										class="ungroup"
										type="button"
										title="Remove from this suggestion"
										aria-label="Remove from this suggestion"
										on:click|stopPropagation={() => handleUngroup(proposal.id, id)}
									>
										Ungroup
									</button>
								{/if}
							</div>
						{/if}
					{/each}
				</div>

				<div class="proposal-actions">
					<button class="btn primary" type="button" on:click={() => handleConfirm(proposal)}>
						Confirm group
					</button>

					<button class="btn" type="button" on:click={() => handleDiscard(proposal.id)}>
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
		border-radius: 10px;
		padding: 0.75rem;
		background: #f8fafc;
	}

	.proposal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.count {
		font-size: 0.75rem;
		color: #334155;
		font-weight: 600;
	}

	.confidence {
		font-size: 0.7rem;
		color: #64748b;
		background: #e2e8f0;
		padding: 0.2rem 0.45rem;
		border-radius: 6px;
	}

	.reason {
		font-size: 0.75rem;
		color: #475569;
		margin-bottom: 0.6rem;
	}

	.proposal-images {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.thumb {
		position: relative;
		width: 84px;
		height: 84px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: white;
	}

	/* small overlay action */
	.ungroup {
		all: unset;
		position: absolute;
		left: 6px;
		bottom: 6px;
		padding: 0.12rem 0.35rem;
		font-size: 0.65rem;
		line-height: 1;
		border-radius: 6px;
		cursor: pointer;

		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.12);
		color: #0f172a;
	}

	.ungroup:hover {
		background: rgba(255, 255, 255, 1);
	}

	.proposal-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn,
	.icon-btn {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: white;
		color: #0f172a;
	}

	.btn:hover,
	.icon-btn:hover {
		background: #f1f5f9;
	}

	.btn.primary {
		background: #d1fae5;
		color: #065f46;
		border-color: rgba(6, 95, 70, 0.25);
	}

	.btn.primary:hover {
		background: #a7f3d0;
	}

	.empty {
		padding: 0.75rem;
		font-size: 0.75rem;
		color: #6b7280;
	}
</style>
