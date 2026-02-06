<script>
	import Toast from '$lib/ui/Toast.svelte';
	import { showToast } from '$lib/ui/toast';
	import HelpModal from '$lib/modals/HelpModal.svelte';
	import AboutModal from '$lib/modals/AboutModal.svelte';
	import Header from '$lib/Header.svelte';
	import SidePanel from '$lib/components/SidePanel.svelte';
	import ImagePairList from '$lib/components/ImagePairList.svelte';
	import {
		projectStore,
		selectedPairId,
		activePair,
		cleanupProject,
		serialiseProject
	} from '$lib/stores/projectStore';

	/* -----------------------------
	   UI state
	----------------------------- */
	let showHelp = false;
	let showAbout = false;
	let imagesPanelOpen = false;

	/* -----------------------------
	   Data loading and saving
	----------------------------- */
	async function handleLoadProject() {
		imagesPanelOpen = true;

		const { files, dir } = event.detail;

		const prev = get(projectStore);
		if (prev?.imagePairs) cleanupProject(prev);

		projectDirHandle = dir;

		const data = await loadProjectFromFiles(files);
		projectStore.set(data);
	}

	async function handleSaveProject() {
		console.log('Save project triggered');
		showToast('Project saved successfully!');
	}
</script>

<div class="app">
	<Toast />
	<Header
		on:load-project={handleLoadProject}
		on:save-project={handleSaveProject}
		on:help={() => (showHelp = true)}
		on:about={() => (showAbout = true)}
	/>
	<div class="workspace">
		<SidePanel side="left" bind:open={imagesPanelOpen}>
			<span slot="header" class="panel-title">Images</span>
			{#if $projectStore}
				<ImagePairList
					imagePairs={$projectStore.imagePairs}
					selectedId={$selectedPairId}
					on:select={(e) => selectedPairId.set(e.detail.id)}
				/>
			{:else}
				<div class="empty">No project loaded</div>
			{/if}
		</SidePanel>

		<div class="main-content"><!-- This is where we select and pair images --></div>
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
