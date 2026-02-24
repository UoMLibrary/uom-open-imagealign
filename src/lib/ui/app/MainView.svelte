<script lang="ts">
	import Toast from '$lib/ui/shared/ui/Toast.svelte';
	import { showToast } from '$lib/ui/shared/ui/toast';
	import HelpModal from '$lib/ui/app/modals/HelpModal.svelte';
	import AboutModal from '$lib/ui/app/modals/AboutModal.svelte';
	import Header from '$lib/ui/app/Header.svelte';
	import WorkspaceShell from '$lib/workspace/WorkspaceShell.svelte';
	import PanelHeader from '$lib/ui/shared/ui/PanelHeader.svelte';
	import SidePanel from '$lib/ui/app/SidePanel.svelte';
	import ImageGroupList from '$lib/ui/features/grouping/GroupList.svelte';
	import GroupPanel from '$lib/workspace/panels/GroupPanel.svelte';
	import GroupProposalList from '$lib/workspace/panels/GroupProposalList.svelte';
	import ImageThumbnailGrid from '$lib/ui/features/thumbnails/ImageThumbnailGrid.svelte';
	import { ungroupedImageIds } from '$lib/ui/features/thumbnails/imageVisibility';
	import { images, groups, project } from '$lib/core/projectStore';

	/* -----------------------------
     UI state
  ----------------------------- */
	let showHelp = false;
	let showAbout = false;
	let GroupListPanelOpen = true;

	// UI-only selection state
	let selectedGroupId: string | null = null;

	/* -----------------------------
     Save feedback (load is handled by button)
  ----------------------------- */
	function handleSaveProject() {
		showToast('Project saved', 'success');
	}

	$: allImageIds = $images.map((img) => img.id);

	// Groups are added but sidebar might be closed → user doesn’t see them. Open it automatically when groups appear.
	let previousGroupCount = 0;
	$: {
		const current = $groups.length;

		if (current > 0 && previousGroupCount === 0) {
			GroupListPanelOpen = true;
		}

		previousGroupCount = current;
	}
</script>

<div class="app">
	<Toast />

	<Header on:help={() => (showHelp = true)} on:about={() => (showAbout = true)} />

	<WorkspaceShell />
	<!-- 
	<div class="workspace">
		<SidePanel side="left" bind:open={GroupListPanelOpen}>
			<PanelHeader inline={true}>
				<h2 class="panel-title">Grouped Images</h2>
			</PanelHeader>

			{#if $groups.length > 0}
				<ImageGroupList
					groups={$groups}
					{selectedGroupId}
					on:select={(e) => (selectedGroupId = e.detail.id)}
				/>
			{:else if $images.length > 0}
				<div class="empty">&nbsp;</div>
			{:else}
				<div class="empty">&nbsp;</div>
			{/if}
		</SidePanel>

		<div class="main-content">
			<div class="main-content">
				<GroupPanel />

				<div>
					<PanelHeader inline={true}>
						<h2 class="panel-title">Proposed Image Groups</h2>
					</PanelHeader>
					<GroupProposalList />
				</div>

				
				{#if $ungroupedImageIds.length > 0}
					<div>
						<PanelHeader inline={true}>
							<h2 class="panel-title">Ungrouped Images</h2>
						</PanelHeader>
						<ImageThumbnailGrid visibleImageIds={$ungroupedImageIds} />
					</div>
				{/if}
			</div>
		</div>
	</div> -->

	<HelpModal bind:open={showHelp} />
	<AboutModal bind:open={showAbout} />
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
	}

	.workspace {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-rows: 1fr;
		overflow: hidden;
	}

	.main-content {
		overflow: auto;
	}

	.empty {
		padding: 1rem;
		font-size: 0.875rem;
		color: #666;
	}

	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #444;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		user-select: none;
	}
</style>
