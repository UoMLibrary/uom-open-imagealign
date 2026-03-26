<script lang="ts">
	import AppHeader from '$lib/ui/shell/AppHeader.svelte';
	import Toast from '$lib/ui/shared/Toast.svelte';
	import HelpDialog from '$lib/ui/shell/dialogs/HelpDialog.svelte';
	import AboutDialog from '$lib/ui/shell/dialogs/AboutDialog.svelte';
	import WorkspaceView from '$lib/ui/workspace/WorkspaceView.svelte';
	import SettingsView from '$lib/ui/settings/SettingsView.svelte';
	import NewFromFolderDialog, {
		type NewFromFolderSelection
	} from '$lib/ui/shell/dialogs/NewFromFolderDialog.svelte';
	import ExportDialog, { type ExportSelection } from '$lib/ui/shell/dialogs/ExportDialog.svelte';

	import {
		closeProject,
		projectState,
		newProjectFromFolder,
		newProjectFromSpreadsheet,
		openProject,
		relinkAssetFolder,
		saveProject,
		saveProjectAs
	} from '$lib/project/projectStore.svelte';

	import { exportCurrentProject } from '$lib/project/projectExport';

	type AppViewMode = 'workspace' | 'settings';

	let activeView = $state<AppViewMode>('workspace');
	let showHelp = $state(false);
	let showAbout = $state(false);
	let showNewFromFolder = $state(false);
	let showExportModal = $state(false);

	function handleOpenNewFromFolder() {
		activeView = 'workspace';
		showNewFromFolder = true;
	}

	async function handleConfirmNewFromFolder(selection: NewFromFolderSelection) {
		showNewFromFolder = false;

		await newProjectFromFolder({
			importGroupingProfileId: selection.importGroupingProfileId,
			annotationSchemaProfileId: selection.annotationSchemaProfileId
		});
	}

	function handleOpenExport() {
		if (!projectState.project) return;
		showExportModal = true;
	}

	function suggestedExportFilename() {
		const title =
			projectState.project?.title
				?.trim()
				.replace(/[^\w.-]+/g, '-')
				.replace(/-+/g, '-') || 'export';

		return title.toLowerCase().endsWith('.json') ? title : `${title}.json`;
	}

	async function handleConfirmExport(selection: ExportSelection) {
		showExportModal = false;

		if (!selection.exportProfileId) return;

		await exportCurrentProject(selection.exportProfileId, selection.filename);
	}
</script>

<div class="app">
	<Toast />

	<AppHeader
		{activeView}
		canCloseProject={!!projectState.project}
		canSave={!!projectState.project}
		canExport={!!projectState.project}
		canRelinkAssetFolder={!!projectState.project && projectState.project.assetRoots.length > 0}
		busy={projectState.busyAction !== null}
		onShowWorkspace={() => (activeView = 'workspace')}
		onShowSettings={() => (activeView = 'settings')}
		onNewFromFolder={handleOpenNewFromFolder}
		onNewFromSpreadsheet={newProjectFromSpreadsheet}
		onOpenProject={openProject}
		onCloseProject={closeProject}
		onRelinkAssetFolder={relinkAssetFolder}
		onSave={saveProject}
		onSaveAs={saveProjectAs}
		onExport={handleOpenExport}
		onHelp={() => (showHelp = true)}
		onAbout={() => (showAbout = true)}
	/>

	<div class="main-area">
		{#if activeView === 'workspace'}
			<WorkspaceView />
		{:else}
			<SettingsView />
		{/if}
	</div>

	<NewFromFolderDialog
		open={showNewFromFolder}
		onClose={() => (showNewFromFolder = false)}
		onConfirm={handleConfirmNewFromFolder}
	/>

	<ExportDialog
		open={showExportModal}
		defaultFilename={suggestedExportFilename()}
		onClose={() => (showExportModal = false)}
		onConfirm={handleConfirmExport}
	/>

	<HelpDialog bind:open={showHelp} />
	<AboutDialog bind:open={showAbout} />
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
