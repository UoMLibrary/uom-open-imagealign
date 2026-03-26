<script lang="ts">
	import Header from '$lib/ui/app/Header.svelte';
	import Toast from '$lib/ui/shared/Toast.svelte';
	import HelpModal from '$lib/ui/app/modals/HelpModal.svelte';
	import AboutModal from '$lib/ui/app/modals/AboutModal.svelte';
	import ProjectWorkspace from '$lib/ui/app/ProjectWorkspace.svelte';
	import SettingsWorkspace from '$lib/ui/app/SettingsWorkspace.svelte';
	import NewFromFolderModal from '$lib/ui/app/modals/NewFromFolderModal.svelte';

	import {
		projectState,
		newProjectFromFolder,
		newProjectFromSpreadsheet,
		openProject,
		relinkAssetFolder,
		saveProject,
		saveProjectAs
	} from '$lib/core/projectStore.svelte';

	import type { ProjectProfileSelection } from '$lib/core/settingsStore.svelte';

	type MainViewMode = 'workspace' | 'settings';

	let activeView = $state<MainViewMode>('workspace');
	let showHelp = $state(false);
	let showAbout = $state(false);
	let showNewFromFolder = $state(false);

	function handleOpenNewFromFolder() {
		activeView = 'workspace';
		showNewFromFolder = true;
	}

	async function handleConfirmNewFromFolder(selection: ProjectProfileSelection) {
		showNewFromFolder = false;

		await newProjectFromFolder({
			importGroupingProfileId: selection.importGroupingProfileId,
			annotationSchemaProfileId: selection.annotationSchemaProfileId,
			exportProfileId: selection.exportProfileId
		});
	}
</script>

<div class="app">
	<Toast />

	<Header
		{activeView}
		canSave={!!projectState.project}
		canExport={!!projectState.project}
		canRelinkAssetFolder={!!projectState.project && projectState.project.assetRoots.length > 0}
		busy={projectState.busyAction !== null}
		onShowWorkspace={() => (activeView = 'workspace')}
		onShowSettings={() => (activeView = 'settings')}
		onNewFromFolder={handleOpenNewFromFolder}
		onNewFromSpreadsheet={newProjectFromSpreadsheet}
		onOpenProject={openProject}
		onRelinkAssetFolder={relinkAssetFolder}
		onSave={saveProject}
		onSaveAs={saveProjectAs}
		onExport={() => console.log('Export not wired yet')}
		onHelp={() => (showHelp = true)}
		onAbout={() => (showAbout = true)}
	/>

	<div class="main-area">
		{#if activeView === 'workspace'}
			<ProjectWorkspace />
		{:else}
			<SettingsWorkspace />
		{/if}
	</div>

	<NewFromFolderModal
		open={showNewFromFolder}
		onClose={() => (showNewFromFolder = false)}
		onConfirm={handleConfirmNewFromFolder}
	/>

	<HelpModal bind:open={showHelp} />
	<AboutModal bind:open={showAbout} />
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
		min-height: 0;
	}

	.main-area {
		min-height: 0;
		overflow: hidden;
	}
</style>
