<script lang="ts">
	import Header from '$lib/ui/app/Header.svelte';
	import Toast from '$lib/ui/shared/Toast.svelte';
	import HelpModal from '$lib/ui/app/modals/HelpModal.svelte';
	import AboutModal from '$lib/ui/app/modals/AboutModal.svelte';
	import ProjectWorkspace from '$lib/ui/app/ProjectWorkspace.svelte';

	import {
		projectState,
		newProjectFromFolder,
		newProjectFromSpreadsheet,
		openProject,
		relinkAssetFolder,
		saveProject,
		saveProjectAs
	} from '$lib/core/projectStore.svelte';

	// UI state
	let showHelp = false;
	let showAbout = false;

	function handleExport() {
		// next step: switch to an Export workspace or open an Export modal
		console.log('Export not wired yet');
	}
</script>

<div class="app">
	<Toast />
	<Header
		canSave={!!projectState.project}
		canExport={!!projectState.project}
		canRelinkAssetFolder={!!projectState.project && projectState.project.assetRoots.length > 0}
		busy={projectState.busyAction !== null}
		onNewFromFolder={() => newProjectFromFolder()}
		onNewFromSpreadsheet={newProjectFromSpreadsheet}
		onOpenProject={openProject}
		onRelinkAssetFolder={relinkAssetFolder}
		onSave={saveProject}
		onSaveAs={saveProjectAs}
		onExport={handleExport}
		onHelp={() => (showHelp = true)}
		onAbout={() => (showAbout = true)}
	/>

	<ProjectWorkspace />

	<HelpModal bind:open={showHelp} />
	<AboutModal bind:open={showAbout} />
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
	}
</style>
