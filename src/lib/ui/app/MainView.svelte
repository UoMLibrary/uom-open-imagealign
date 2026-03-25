<script lang="ts">
	import Header from '$lib/ui/app/Header.svelte';
	import Toast from '$lib/ui/shared/Toast.svelte';
	import HelpModal from '$lib/ui/app/modals/HelpModal.svelte';
	import AboutModal from '$lib/ui/app/modals/AboutModal.svelte';
	import ProjectWorkspace from '$lib/ui/app/ProjectWorkspace.svelte';
	import SettingsWorkspace from '$lib/ui/app/SettingsWorkspace.svelte';

	import {
		projectState,
		newProjectFromFolder,
		newProjectFromSpreadsheet,
		openProject,
		relinkAssetFolder,
		saveProject,
		saveProjectAs
	} from '$lib/core/projectStore.svelte';

	type MainViewMode = 'workspace' | 'settings';

	let activeView = $state<MainViewMode>('workspace');
	let showHelp = $state(false);
	let showAbout = $state(false);

	async function handleNewFromFolder() {
		activeView = 'workspace';
		await newProjectFromFolder();
	}

	async function handleNewFromSpreadsheet() {
		activeView = 'workspace';
		await newProjectFromSpreadsheet();
	}

	async function handleOpenProject() {
		activeView = 'workspace';
		await openProject();
	}

	async function handleRelinkAssetFolder() {
		activeView = 'workspace';
		await relinkAssetFolder();
	}

	async function handleSave() {
		await saveProject();
	}

	async function handleSaveAs() {
		await saveProjectAs();
	}

	function handleExport() {
		activeView = 'workspace';
		console.log('Export not wired yet');
	}

	function showWorkspace() {
		activeView = 'workspace';
	}

	function showSettings() {
		activeView = 'settings';
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
		onShowWorkspace={showWorkspace}
		onShowSettings={showSettings}
		onNewFromFolder={handleNewFromFolder}
		onNewFromSpreadsheet={handleNewFromSpreadsheet}
		onOpenProject={handleOpenProject}
		onRelinkAssetFolder={handleRelinkAssetFolder}
		onSave={handleSave}
		onSaveAs={handleSaveAs}
		onExport={handleExport}
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
