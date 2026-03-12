<script lang="ts">
	import { imagesById } from '$lib/core/projectStore';
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type GroupLike = {
		id: string;
		baseImageId: string;
		imageIds: string[];
		locked?: boolean;
		status?: 'draft' | 'locked';
	};

	export let groups: GroupLike[] = [];
	export let selectedGroupId: string | null = null;

	// Svelte 5-style callback props, but this component still uses normal Svelte syntax
	export let onSelect: ((id: string) => void) | undefined;
	export let onOpenGroup: ((id: string) => void) | undefined;
	export let onDropUngroupedOnGroup: ((groupId: string) => void) | undefined;

	let dropTargetGroupId: string | null = null;

	function selectGroup(id: string) {
		onSelect?.(id);
	}

	function openGroup(id: string) {
		onOpenGroup?.(id);
	}

	function handleKeydown(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectGroup(id);
		}

		if (event.key === 'o' || event.key === 'O') {
			event.preventDefault();
			openGroup(id);
		}
	}

	function handleDragEnter(event: DragEvent, groupId: string) {
		event.preventDefault();
		dropTargetGroupId = groupId;
	}

	function handleDragOver(event: DragEvent, groupId: string) {
		event.preventDefault();
		if (dropTargetGroupId !== groupId) {
			dropTargetGroupId = groupId;
		}
	}

	function handleDragLeave(event: DragEvent, groupId: string) {
		const current = event.currentTarget as HTMLElement | null;
		const related = event.relatedTarget as Node | null;

		if (!current || (related && current.contains(related))) return;
		if (dropTargetGroupId === groupId) dropTargetGroupId = null;
	}

	function handleDrop(event: DragEvent, groupId: string) {
		event.preventDefault();
		dropTargetGroupId = null;
		onDropUngroupedOnGroup?.(groupId);
	}
</script>

<div class="group-board">
	{#if groups.length === 0}
		<div class="empty-state">
			<div class="empty-title">No groups yet</div>
			<div class="empty-copy">
				Create a single-image group, drag one unassigned image onto another, or apply a suggestion.
			</div>
		</div>
	{:else}
		<div class="group-grid">
			{#each groups as group (group.id)}
				{@const base = $imagesById[group.baseImageId]}
				{@const otherIds = group.imageIds.filter((id) => id !== group.baseImageId)}
				{@const previewIds = otherIds.slice(0, 3)}
				{@const isSelected = selectedGroupId === group.id}
				{@const isDropTarget = dropTargetGroupId === group.id}
				{@const imageCount = group.imageIds.length}
				{@const status = group.status ?? (group.locked ? 'locked' : 'draft')}

				<div
					class:selected={isSelected}
					class:drop-target={isDropTarget}
					class="group-card"
					role="button"
					tabindex="0"
					aria-pressed={isSelected}
					aria-label={`Group ${base?.name ?? group.id}`}
					on:click={() => selectGroup(group.id)}
					on:dblclick={() => openGroup(group.id)}
					on:keydown={(event) => handleKeydown(event, group.id)}
					on:dragenter={(event) => handleDragEnter(event, group.id)}
					on:dragover={(event) => handleDragOver(event, group.id)}
					on:dragleave={(event) => handleDragLeave(event, group.id)}
					on:drop={(event) => handleDrop(event, group.id)}
				>
					<div class="cover-wrap">
						<div class="cover-frame">
							{#if base?.contentHash}
								<CachedThumb contentHash={base.contentHash} alt={base.name ?? 'Base image'} />
							{:else}
								<div class="cover-fallback">No preview</div>
							{/if}
						</div>

						<div class="count-badge">{imageCount}</div>

						{#if status === 'locked'}
							<div class="status-badge locked">Locked</div>
						{:else}
							<div class="status-badge draft">Draft</div>
						{/if}
					</div>

					<div class="card-body">
						<div class="title-row">
							<div class="title" title={base?.name ?? group.id}>
								{base?.name ?? `Group ${group.id}`}
							</div>
						</div>

						<div class="meta-row">
							<div class="meta">Base image</div>
							<div class="meta">
								{imageCount}
								{imageCount === 1 ? 'image' : 'images'}
							</div>
						</div>

						{#if previewIds.length > 0}
							<div class="member-strip" aria-label="Additional images in this group">
								{#each previewIds as id (id)}
									{@const item = $imagesById[id]}
									<div class="member-thumb" title={item?.name ?? id}>
										{#if item?.contentHash}
											<CachedThumb
												contentHash={item.contentHash}
												alt={item.name ?? 'Group image'}
											/>
										{:else}
											<div class="thumb-fallback"></div>
										{/if}
									</div>
								{/each}

								{#if otherIds.length > previewIds.length}
									<div class="more-pill">+{otherIds.length - previewIds.length}</div>
								{/if}
							</div>
						{:else}
							<div class="single-note">Single-image group</div>
						{/if}
					</div>

					<div class="card-actions">
						<button
							type="button"
							class="action-btn"
							on:click|stopPropagation={() => openGroup(group.id)}
						>
							Open
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.group-board {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		background: #fff;
	}

	.group-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.9rem;
		align-content: start;
	}

	.group-card {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.9rem;
		padding: 0.75rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
		cursor: pointer;
		outline: none;
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease,
			transform 120ms ease,
			background 120ms ease;
	}

	.group-card:hover {
		border-color: #cfd8e3;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
		transform: translateY(-1px);
	}

	.group-card:focus-visible {
		box-shadow:
			0 0 0 3px rgba(59, 130, 246, 0.16),
			0 4px 12px rgba(0, 0, 0, 0.06);
		border-color: #60a5fa;
	}

	.group-card.selected {
		border-color: #60a5fa;
		box-shadow:
			0 0 0 3px rgba(59, 130, 246, 0.14),
			0 4px 12px rgba(0, 0, 0, 0.06);
		background: #fbfdff;
	}

	.group-card.drop-target {
		border-color: #34d399;
		box-shadow:
			0 0 0 3px rgba(52, 211, 153, 0.16),
			0 4px 12px rgba(0, 0, 0, 0.06);
		background: #f0fdf4;
	}

	.cover-wrap {
		position: relative;
	}

	.cover-frame {
		aspect-ratio: 4 / 3;
		border-radius: 0.7rem;
		overflow: hidden;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		border: 1px solid #e5e7eb;
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
		font-size: 0.85rem;
		color: #6b7280;
	}

	.count-badge,
	.status-badge {
		position: absolute;
		top: 0.55rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.55rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		backdrop-filter: blur(8px);
	}

	.count-badge {
		right: 0.55rem;
		min-width: 1.55rem;
		background: rgba(17, 24, 39, 0.82);
		color: white;
	}

	.status-badge {
		left: 0.55rem;
	}

	.status-badge.draft {
		background: rgba(255, 255, 255, 0.9);
		color: #374151;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.status-badge.locked {
		background: rgba(220, 252, 231, 0.92);
		color: #166534;
		border: 1px solid rgba(34, 197, 94, 0.24);
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
		gap: 0.5rem;
		min-width: 0;
	}

	.title {
		font-weight: 600;
		color: #111827;
		font-size: 0.95rem;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.meta {
		font-size: 0.78rem;
		color: #6b7280;
	}

	.member-strip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.15rem;
		min-height: 2.6rem;
	}

	.member-thumb {
		width: 2.6rem;
		height: 2.6rem;
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
		padding: 0 0.65rem;
		border-radius: 999px;
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		font-size: 0.78rem;
		font-weight: 600;
		color: #374151;
		flex: 0 0 auto;
	}

	.single-note {
		font-size: 0.8rem;
		color: #6b7280;
		padding-top: 0.1rem;
	}

	.card-actions {
		display: flex;
		justify-content: flex-end;
	}

	.action-btn {
		border: 1px solid #d1d5db;
		background: white;
		color: #374151;
		border-radius: 0.55rem;
		padding: 0.42rem 0.7rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.action-btn:hover {
		background: #f9fafb;
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
