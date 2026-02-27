<script lang="ts">
	import Header from '$lib/ui/app/Header.svelte';
	import WorkspaceShell from '$lib/ui/app/WorkspaceShell.svelte';
	import Toast from '$lib/ui/shared/Toast.svelte';
	import HelpModal from '$lib/ui/app/modals/HelpModal.svelte';
	import AboutModal from '$lib/ui/app/modals/AboutModal.svelte';

	// UI state
	let showHelp = false;
	let showAbout = false;
</script>

<div class="app">
	<Toast />
	<Header onHelp={() => (showHelp = true)} onAbout={() => (showAbout = true)} />
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
