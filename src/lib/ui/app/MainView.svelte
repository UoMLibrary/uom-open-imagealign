<script lang="ts">
	import Toast from '$lib/ui/shared/ui/Toast.svelte';
	import { showToast } from '$lib/ui/shared/ui/toast';
	import HelpModal from '$lib/ui/app/modals/HelpModal.svelte';
	import AboutModal from '$lib/ui/app/modals/AboutModal.svelte';
	import Header from '$lib/ui/app/Header.svelte';
	import WorkspaceShell from '$lib/workspace/WorkspaceShell.svelte';
	import { groups } from '$lib/core/projectStore';

	/* -----------------------------
     UI state
  ----------------------------- */
	let showHelp = false;
	let showAbout = false;

	/* -----------------------------
     Save feedback (load is handled by button)
  	----------------------------- */
	function handleSaveProject() {
		showToast('Project saved', 'success');
	}
</script>

<div class="app">
	<Toast />

	<Header on:help={() => (showHelp = true)} on:about={() => (showAbout = true)} />

	<WorkspaceShell />

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
