<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { images, groups, project, updateProjectUI } from '$lib/core/projectStore';
	import { applyGroupingProposal } from '$lib/services/groupService';
	import { groupingState, initialiseSingleImageProposals } from '$lib/core/groupingStore';
	import type { GroupingProposal } from '$lib/core/groupingStore';

	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import GroupStrategyPanel from './GroupStrategyPanel.svelte';

	// New workspace pieces
	import UngroupedImagePool from './UngroupedImagePool.svelte';
	import GroupSuggestionTray from './GroupSuggestionTray.svelte';
	import GroupBoard from './GroupBoard.svelte';
	import GroupEditorPanel from './GroupEditorPanel.svelte';

	let selectedGroupId: string | null = null;
	let leftPanelOpen = true;
	let suggestionsCollapsed = false;

	/**
	 * IDs currently selected in the unassigned pool.
	 * Keep this as an array for easy prop passing to children.
	 */
	let selectedUngroupedIds: string[] = [];

	/* ------------------------------------------------
	   Derived state
	------------------------------------------------ */
	$: groupIds = $groups.map((g) => g.id);

	$: groupedImageIds = new Set($groups.flatMap((g) => g.imageIds));

	$: ungroupedImages = $images.filter((img) => !groupedImageIds.has(img.id));

	$: selectedGroup = $groups.find((g) => g.id === selectedGroupId) ?? null;

	/* ------------------------------------------------
	   Restore / maintain selected group
	------------------------------------------------ */
	$: {
		if (groupIds.length === 0) {
			if (selectedGroupId !== null) {
				selectedGroupId = null;
			}
		} else if (!selectedGroupId || !groupIds.includes(selectedGroupId)) {
			const last = $project.ui?.lastSelectedGroupId;
			const next = last && groupIds.includes(last) ? last : groupIds[0];

			if (selectedGroupId !== next) {
				selectedGroupId = next;
			}
		}
	}

	$: if (selectedGroupId && !$groups.some((g) => g.id === selectedGroupId)) {
		selectedGroupId = null;
	}

	onMount(() => {
		if (get(images).length > 0) {
			initialiseSingleImageProposals();
		}
	});

	/* ------------------------------------------------
	   Selection helpers
	------------------------------------------------ */
	function selectGroup(id: string) {
		selectedGroupId = id;

		updateProjectUI({
			lastSelectedGroupId: id
		});
	}

	function setUngroupedSelection(ids: string[]) {
		selectedUngroupedIds = ids;
	}

	function clearUngroupedSelection() {
		selectedUngroupedIds = [];
	}

	/* ------------------------------------------------
	   Proposal handling
	------------------------------------------------ */
	function clearProposalsUsingImages(imageIds: string[]) {
		const affected = new Set(imageIds);

		groupingState.update((state) => {
			const remaining = state.proposals.filter((p) => !p.imageIds.some((id) => affected.has(id)));

			return {
				...state,
				proposals: remaining,
				selected: new Set()
			};
		});
	}

	function handleCreateGroupFromProposal(proposal: GroupingProposal) {
		applyGroupingProposal(proposal);
		clearProposalsUsingImages(proposal.imageIds);
	}

	function handleAddProposalToSelectedGroup(proposal: GroupingProposal) {
		if (!selectedGroupId) {
			handleCreateGroupFromProposal(proposal);
			return;
		}

		/**
		 * TODO:
		 * replace this with your real group service call, e.g.
		 * addImagesToGroup(selectedGroupId, proposal.imageIds)
		 */
		console.log('TODO add proposal images to selected group', {
			groupId: selectedGroupId,
			imageIds: proposal.imageIds
		});

		clearProposalsUsingImages(proposal.imageIds);
	}

	function handleDiscardProposal(id: string) {
		groupingState.update((state) => ({
			...state,
			proposals: state.proposals.filter((p) => p.id !== id),
			selected: new Set([...state.selected].filter((x) => x !== id))
		}));
	}

	/* ------------------------------------------------
	   Manual grouping actions from unassigned pool
	------------------------------------------------ */
	function handleCreateSingleImageGroup(imageId: string) {
		/**
		 * TODO:
		 * create a real manual single-image group in your service layer
		 * e.g. createGroupFromImageIds([imageId], { baseImageId: imageId })
		 */
		console.log('TODO create single-image group', { imageId });

		clearUngroupedSelection();
		clearProposalsUsingImages([imageId]);
	}

	function handleCreateGroupFromUngroupedSelection() {
		if (selectedUngroupedIds.length === 0) return;

		/**
		 * TODO:
		 * create a real manual group from selectedUngroupedIds
		 */
		console.log('TODO create group from selection', {
			imageIds: selectedUngroupedIds
		});

		clearUngroupedSelection();
		clearProposalsUsingImages(selectedUngroupedIds);
	}

	function handleAddUngroupedSelectionToGroup(groupId: string) {
		if (!groupId || selectedUngroupedIds.length === 0) return;

		/**
		 * TODO:
		 * add selectedUngroupedIds to the group
		 */
		console.log('TODO add selection to group', {
			groupId,
			imageIds: selectedUngroupedIds
		});

		clearUngroupedSelection();
		clearProposalsUsingImages(selectedUngroupedIds);
	}

	/* ------------------------------------------------
	   Group editor actions
	------------------------------------------------ */
	function handleAddImagesToSelectedGroup(imageIds: string[]) {
		if (!selectedGroupId || imageIds.length === 0) return;

		/**
		 * TODO:
		 * add imageIds to selectedGroupId
		 */
		console.log('TODO editor add images to selected group', {
			groupId: selectedGroupId,
			imageIds
		});

		clearProposalsUsingImages(imageIds);
	}

	function handleRemoveImageFromSelectedGroup(imageId: string) {
		if (!selectedGroupId) return;

		/**
		 * TODO:
		 * remove imageId from selectedGroupId
		 * If a group reaches 0 items, delete it.
		 * If base image is removed, choose a new base.
		 */
		console.log('TODO remove image from group', {
			groupId: selectedGroupId,
			imageId
		});
	}

	function handleSetBaseImage(groupId: string, imageId: string) {
		/**
		 * TODO:
		 * set group.baseImageId = imageId
		 */
		console.log('TODO set base image', { groupId, imageId });
	}

	function handleReorderGroup(groupId: string, orderedImageIds: string[]) {
		/**
		 * TODO:
		 * persist ordered image ids on the group
		 */
		console.log('TODO reorder group', { groupId, orderedImageIds });
	}

	function handleOpenGroup(id: string) {
		selectGroup(id);
	}
</script>

<div class="group-layout">
	<SidePanel side="left" bind:open={leftPanelOpen} width={320}>
		<svelte:fragment slot="header">
			<div class="panel-header">
				<div class="header-row">
					<div class="panel-title">Unassigned</div>
					<div class="panel-meta">{ungroupedImages.length}</div>
				</div>
			</div>
		</svelte:fragment>

		<UngroupedImagePool
			images={ungroupedImages}
			selectedIds={selectedUngroupedIds}
			{selectedGroupId}
			onSelectionChange={setUngroupedSelection}
			onCreateSingleGroup={(imageId) => handleCreateSingleImageGroup(imageId)}
			onCreateGroupFromSelection={handleCreateGroupFromUngroupedSelection}
			onAddSelectionToGroup={() =>
				selectedGroupId && handleAddUngroupedSelectionToGroup(selectedGroupId)}
		/>
	</SidePanel>

	<div class="workspace">
		<div class="suggestions-bar">
			<div class="section-header">
				<div class="section-title">Suggestions</div>

				<div class="section-actions">
					<div class="section-meta">{$groupingState.proposals.length}</div>

					<button
						type="button"
						class="ghost-btn"
						on:click={() => (suggestionsCollapsed = !suggestionsCollapsed)}
					>
						{suggestionsCollapsed ? 'Show' : 'Hide'}
					</button>
				</div>
			</div>

			{#if !suggestionsCollapsed}
				<GroupSuggestionTray
					proposals={$groupingState.proposals}
					{selectedGroupId}
					onCreateGroup={(proposal) => handleCreateGroupFromProposal(proposal)}
					onAddToSelectedGroup={(proposal) => handleAddProposalToSelectedGroup(proposal)}
					onDiscard={(id) => handleDiscardProposal(id)}
				/>
			{/if}
		</div>

		<div class="main-row">
			<div class="board-panel">
				<div class="section-header">
					<div class="section-title">Groups</div>
					<div class="section-meta">{$groups.length}</div>
				</div>

				<GroupBoard
					groups={$groups}
					{selectedGroupId}
					onSelect={(id) => selectGroup(id)}
					onOpenGroup={(id) => handleOpenGroup(id)}
					onDropUngroupedOnGroup={(groupId) => handleAddUngroupedSelectionToGroup(groupId)}
				/>
			</div>

			<div class="editor-panel">
				<div class="section-header">
					<div class="section-title">Group editor</div>
					{#if selectedGroup}
						<div class="section-meta">{selectedGroup.imageIds.length} images</div>
					{/if}
				</div>

				{#if selectedGroup}
					<GroupEditorPanel
						group={selectedGroup}
						allImages={$images}
						{ungroupedImages}
						onAddImages={(imageIds) => handleAddImagesToSelectedGroup(imageIds)}
						onRemoveImage={(imageId) => handleRemoveImageFromSelectedGroup(imageId)}
						onSetBaseImage={(imageId) => handleSetBaseImage(selectedGroup.id, imageId)}
						onReorder={(orderedImageIds) => handleReorderGroup(selectedGroup.id, orderedImageIds)}
					/>
				{:else}
					<div class="empty-state">
						<div class="empty-title">No group selected</div>
						<div class="empty-copy">
							Select a group card to inspect it, reorder images, remove items, or choose a base
							image.
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="strategy">
			<GroupStrategyPanel />
		</div>
	</div>
</div>

<style>
	.group-layout {
		display: flex;
		height: 100%;
		min-height: 0;
		background: #fff;
	}

	.workspace {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.suggestions-bar {
		border-bottom: 1px solid #e5e7eb;
		padding: 0.75rem;
		background: #fafafa;
		max-height: 14rem;
		overflow: auto;
	}

	.main-row {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 360px;
	}

	.board-panel {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid #e5e7eb;
	}

	.editor-panel {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: #fcfcfd;
	}

	.strategy {
		border-top: 1px solid #e5e7eb;
		padding: 0.75rem;
		background: #f9fafb;
	}

	.panel-header,
	.section-header {
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.section-header {
		padding: 0.75rem;
	}

	.header-row,
	.section-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.panel-title,
	.section-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		line-height: 1;
		margin: 0;
	}

	.panel-meta,
	.section-meta {
		font-size: 0.75rem;
		color: #6b7280;
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
		white-space: nowrap;
	}

	.ghost-btn {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #374151;
		border-radius: 0.45rem;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.ghost-btn:hover {
		background: #f9fafb;
	}

	.empty-state {
		padding: 1rem;
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
