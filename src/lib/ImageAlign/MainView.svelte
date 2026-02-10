<script lang="ts">
	import Toast from '$lib/ui/Toast.svelte';
	import { showToast } from '$lib/ui/toast';
	import HelpModal from '$lib/modals/HelpModal.svelte';
	import AboutModal from '$lib/modals/AboutModal.svelte';
	import Header from '$lib/Header.svelte';
	import SidePanel from '$lib/components/SidePanel.svelte';
	import ImageGroupList from '$lib/components/ImageGroupList.svelte';
	import GroupPanel from '$lib/components/GroupPanel.svelte';
	import ImageThumbnailGrid from '$lib/components/ImageThumbnailGrid.svelte';
	import { images, groups, project } from '$lib/stores/projectStore';

	/* -----------------------------
     UI state
  ----------------------------- */
	let showHelp = false;
	let showAbout = false;
	let imagesPanelOpen = false;

	// UI-only selection state
	let selectedGroupId: string | null = null;

	/* -----------------------------
     Save feedback (load is handled by button)
  ----------------------------- */
	function handleSaveProject() {
		showToast('Project saved', 'success');
	}

	$: allImageIds = $images.map((img) => img.id);
</script>

<div class="app">
	<Toast />

	<Header on:help={() => (showHelp = true)} on:about={() => (showAbout = true)} />

	<div class="workspace">
		<SidePanel side="left" bind:open={imagesPanelOpen}>
			<span slot="header" class="panel-title">Images</span>

			{#if $groups.length > 0}
				<ImageGroupList
					groups={$groups}
					selectedId={selectedGroupId}
					on:select={(e) => (selectedGroupId = e.detail.id)}
				/>
			{:else if $images.length > 0}
				<div class="empty">Images imported, no groups yet</div>
			{:else}
				<div class="empty">No images imported</div>
			{/if}
		</SidePanel>

		<div class="main-content">
			<div class="main-content">
				{#if $images.length > 0}
					<ImageThumbnailGrid visibleImageIds={allImageIds} />
				{:else}
					<div class="empty">Import images to begin</div>
				{/if}
				{#if $images.length > 0 && $groups.length === 0}
					<GroupPanel />
				{/if}
			</div>
		</div>
	</div>

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
		display: block;
		padding: 0.5rem 0.75rem;
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
