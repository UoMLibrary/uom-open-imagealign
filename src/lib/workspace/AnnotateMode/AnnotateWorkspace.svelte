<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { createAnnotationEditorSession } from './Viewer/annotationEditorSession';

	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import ViewerShell from './Viewer/ViewerShell.svelte';

	import { groups, imagesById } from '$lib/core/projectStore';
	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';

	let session = createAnnotationEditorSession();
	let selectedGroupId: string | null = null;

	let LeftPanelOpen = true;
	let RightPanelOpen = true;

	/* -------------------------------------------------
	   Close annotation panel on mount if empty
	------------------------------------------------- */

	onMount(() => {
		const existing = get(session.annotations);

		if (!existing || existing.length === 0) {
			RightPanelOpen = false;
		}
	});

	// Keep selection valid / default to first group
	$: {
		const list = $groups;

		if (list.length === 0) {
			selectedGroupId = null;
		} else if (!selectedGroupId || !list.some((g) => g.id === selectedGroupId)) {
			selectedGroupId = list[0].id;
		}
	}

	$: selectedGroup = selectedGroupId ? $groups.find((g) => g.id === selectedGroupId) : null;

	let imageAUrl = '';
	let imageBUrl = '';

	// Pick images for viewer from selected group
	$: {
		if (!selectedGroup || selectedGroup.imageIds.length === 0) {
			imageAUrl = '';
			imageBUrl = '';
		} else {
			const [aId, bIdMaybe] = selectedGroup.imageIds;
			const bId = bIdMaybe ?? aId;

			imageAUrl = $imagesById[aId]?.runtimeUri ?? '';
			imageBUrl = $imagesById[bId]?.runtimeUri ?? '';
		}
	}

	function selectGroup(id: string) {
		selectedGroupId = id;
	}
</script>

<div class="prepare-layout">
	<SidePanel side="left" bind:open={LeftPanelOpen}>
		<div class="panel-header">
			<div class="header-row">
				<div class="panel-title">Groups</div>
			</div>
		</div>

		<div class="panel-body">
			{#if $groups.length === 0}
				<div class="empty">No groups yet</div>
			{:else}
				<div class="group-list">
					{#each $groups as group, idx (`${group.id}:${idx}`)}
						{@const base = $imagesById[group.baseImageId]}
						<button
							type="button"
							class="group-row"
							class:selected={group.id === selectedGroupId}
							on:click={() => selectGroup(group.id)}
						>
							<div class="thumb">
								{#if base}
									<ImageThumbnail
										contentHash={base.hashes?.contentHash}
										fallbackSrc={base.runtimeUri}
										label={base.label}
										mode="thumb"
									/>
								{:else}
									<div class="thumb-fallback" aria-hidden="true" />
								{/if}
							</div>

							<div class="info">
								<div class="title">
									Group <span class="count">{group.imageIds.length}</span>
								</div>
								<div class="subtitle">
									{#if base?.label}{base.label}{:else}Base image{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</SidePanel>

	<div class="viewer">
		{#if imageAUrl && imageBUrl}
			{#key `${selectedGroupId}:${imageAUrl}:${imageBUrl}`}
				<ViewerShell imageA={imageAUrl} imageB={imageBUrl} {session} />
			{/key}
		{:else}
			<div class="viewer-empty">Select a group to view images</div>
		{/if}
	</div>

	<SidePanel side="right" bind:open={RightPanelOpen} width={420}>
		<div class="panel-header">
			<div class="header-row">
				<div class="panel-title">Annotations</div>
			</div>
		</div>
	</SidePanel>
</div>

<style>
	.prepare-layout {
		display: flex;
		height: 100%;
		min-height: 0;
	}

	.viewer {
		flex: 1;
		background: #eee;
		min-width: 0;
	}

	.viewer-empty {
		height: 100%;
		display: grid;
		place-items: center;
		color: #6b7280;
		font-size: 0.9rem;
	}

	/* Shared SidePanel styles */
	.panel-header {
		padding: 0.4rem 0.75rem 0.4rem 1.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		line-height: 1;
		margin: 0;
	}

	.panel-body {
		padding: 0.5rem;
	}

	.empty {
		padding: 0.5rem;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.group-row {
		all: unset;
		cursor: pointer;
		display: grid;
		grid-template-columns: 44px 1fr;
		gap: 0.6rem;
		align-items: center;

		padding: 0.5rem;
		border-radius: 8px;
	}

	.group-row:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.group-row.selected {
		background: rgba(0, 0, 0, 0.08);
	}

	.thumb {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: white;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		background: repeating-linear-gradient(
			45deg,
			rgba(0, 0, 0, 0.06),
			rgba(0, 0, 0, 0.06) 6px,
			rgba(0, 0, 0, 0.02) 6px,
			rgba(0, 0, 0, 0.02) 12px
		);
	}

	.info {
		min-width: 0;
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-weight: 600;
		color: #0f172a;
		font-size: 0.85rem;
	}

	.count {
		font-weight: 600;
		color: #334155;
		font-size: 0.8rem;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
	}

	.subtitle {
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
