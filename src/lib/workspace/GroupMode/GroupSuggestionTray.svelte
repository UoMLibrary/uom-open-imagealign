<script lang="ts">
	import { imagesById } from '$lib/core/projectStore';
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type GroupingProposal = {
		id: string;
		imageIds: string[];
		baseImageId?: string;
		label?: string;
		strategy?: string;
		confidence?: number;
		reason?: string;
	};

	type ImageLike = {
		id: string;
		name?: string;
		contentHash?: string;
		path?: string;
		leafFolderName?: string;
	};

	export let proposals: GroupingProposal[] = [];
	export let selectedGroupId: string | null = null;

	export let onCreateGroup: ((proposal: GroupingProposal) => void) | undefined;
	export let onAddToSelectedGroup: ((proposal: GroupingProposal) => void) | undefined;
	export let onDiscard: ((id: string) => void) | undefined;

	function getPreviewIds(proposal: GroupingProposal) {
		const preferred =
			proposal.baseImageId && proposal.imageIds.includes(proposal.baseImageId)
				? proposal.baseImageId
				: proposal.imageIds[0];

		const rest = proposal.imageIds.filter((id) => id !== preferred);
		return {
			coverId: preferred,
			restIds: rest
		};
	}

	function formatConfidence(confidence?: number) {
		if (confidence == null || Number.isNaN(confidence)) return null;

		// Handles either 0..1 or 0..100
		const pct = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
		return `${pct}%`;
	}

	function createGroup(proposal: GroupingProposal) {
		onCreateGroup?.(proposal);
	}

	function addToSelectedGroup(proposal: GroupingProposal) {
		if (!selectedGroupId) return;
		onAddToSelectedGroup?.(proposal);
	}

	function discardProposal(id: string) {
		onDiscard?.(id);
	}
</script>

<div class="suggestion-tray">
	{#if proposals.length === 0}
		<div class="empty-state">
			<div class="empty-title">No suggestions yet</div>
			<div class="empty-copy">
				Run a grouping strategy, or create groups directly from the unassigned image pool.
			</div>
		</div>
	{:else}
		<div class="tray-scroll">
			{#each proposals as proposal (proposal.id)}
				{@const preview = getPreviewIds(proposal)}
				{@const cover = preview.coverId ? ($imagesById[preview.coverId] as ImageLike) : null}
				{@const rest = preview.restIds}
				{@const previewRest = rest.slice(0, 3)}
				{@const extraCount = Math.max(0, rest.length - previewRest.length)}
				{@const imageCount = proposal.imageIds.length}
				{@const confidenceText = formatConfidence(proposal.confidence)}

				<div class="suggestion-card">
					<div class="cover-wrap">
						<div class="cover-frame">
							{#if cover?.contentHash}
								<CachedThumb
									contentHash={cover.contentHash}
									alt={cover.name ?? 'Suggested image'}
								/>
							{:else}
								<div class="cover-fallback">No preview</div>
							{/if}
						</div>

						<div class="count-badge">{imageCount}</div>

						{#if confidenceText}
							<div class="confidence-badge">{confidenceText}</div>
						{/if}
					</div>

					<div class="card-body">
						<div class="title-row">
							<div class="title" title={proposal.label ?? cover?.name ?? proposal.id}>
								{proposal.label ?? cover?.name ?? `Suggestion ${proposal.id}`}
							</div>
						</div>

						<div class="meta-row">
							{#if proposal.strategy}
								<div class="meta-pill">{proposal.strategy}</div>
							{/if}

							<div class="meta-pill subtle">
								{imageCount}
								{imageCount === 1 ? 'image' : 'images'}
							</div>
						</div>

						{#if proposal.reason}
							<div class="reason" title={proposal.reason}>
								{proposal.reason}
							</div>
						{/if}

						{#if previewRest.length > 0}
							<div class="member-strip" aria-label="Additional images in this suggestion">
								{#each previewRest as id (id)}
									{@const item = $imagesById[id] as ImageLike}
									<div class="member-thumb" title={item?.name ?? id}>
										{#if item?.contentHash}
											<CachedThumb
												contentHash={item.contentHash}
												alt={item.name ?? 'Suggested image'}
											/>
										{:else}
											<div class="thumb-fallback"></div>
										{/if}
									</div>
								{/each}

								{#if extraCount > 0}
									<div class="more-pill">+{extraCount}</div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="card-actions">
						<button type="button" class="mini-btn primary" on:click={() => createGroup(proposal)}>
							Create group
						</button>

						<button
							type="button"
							class="mini-btn"
							disabled={!selectedGroupId}
							title={!selectedGroupId
								? 'Select a group first'
								: 'Add suggested images to selected group'}
							on:click={() => addToSelectedGroup(proposal)}
						>
							Add to selected
						</button>

						<button
							type="button"
							class="mini-btn danger"
							on:click={() => discardProposal(proposal.id)}
						>
							Dismiss
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.suggestion-tray {
		min-height: 0;
	}

	.tray-scroll {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
		align-content: start;
	}

	.suggestion-card {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.9rem;
		background: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.cover-wrap {
		position: relative;
	}

	.cover-frame {
		aspect-ratio: 4 / 3;
		border-radius: 0.7rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
	}

	.cover-frame :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: #6b7280;
		font-size: 0.82rem;
	}

	.count-badge,
	.confidence-badge {
		position: absolute;
		top: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.5rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		backdrop-filter: blur(8px);
	}

	.count-badge {
		right: 0.5rem;
		min-width: 1.5rem;
		background: rgba(17, 24, 39, 0.82);
		color: #fff;
	}

	.confidence-badge {
		left: 0.5rem;
		background: rgba(255, 255, 255, 0.92);
		color: #374151;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.title {
		font-size: 0.95rem;
		font-weight: 600;
		color: #111827;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.meta-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.18rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 700;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1d4ed8;
	}

	.meta-pill.subtle {
		background: #f3f4f6;
		border-color: #e5e7eb;
		color: #4b5563;
	}

	.reason {
		font-size: 0.8rem;
		line-height: 1.35;
		color: #6b7280;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.member-strip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.4rem;
		margin-top: 0.1rem;
	}

	.member-thumb {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.55rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		background: #f3f4f6;
		flex: 0 0 auto;
	}

	.member-thumb :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
	}

	.more-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2rem;
		padding: 0 0.6rem;
		border-radius: 999px;
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		font-size: 0.78rem;
		font-weight: 600;
		color: #374151;
		flex: 0 0 auto;
	}

	.card-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.mini-btn {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #374151;
		border-radius: 0.55rem;
		padding: 0.42rem 0.7rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.mini-btn:hover:not(:disabled) {
		background: #f9fafb;
	}

	.mini-btn.primary {
		border-color: #2563eb;
		background: #2563eb;
		color: #fff;
	}

	.mini-btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	.mini-btn.danger {
		border-color: #fecaca;
		color: #b91c1c;
		background: #fff;
	}

	.mini-btn.danger:hover:not(:disabled) {
		background: #fef2f2;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.empty-state {
		border: 1px dashed #d1d5db;
		border-radius: 0.9rem;
		padding: 1rem;
		background: #fafafa;
		color: #6b7280;
	}

	.empty-title {
		font-weight: 600;
		color: #374151;
		margin-bottom: 0.35rem;
	}

	.empty-copy {
		font-size: 0.9rem;
		line-height: 1.45;
	}
</style>
