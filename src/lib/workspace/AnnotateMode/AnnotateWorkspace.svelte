<script lang="ts">
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';

	let LeftPanelOpen = true;
	let RightPanelOpen = true;
</script>

<div class="prepare-layout">
	<SidePanel side="left" bind:open={LeftPanelOpen}>side panel content</SidePanel>
	<div class="viewer">sasa</div>
	<SidePanel side="right" bind:open={RightPanelOpen}>side panel content</SidePanel>
</div>

<style>
	.prepare-layout {
		display: flex;
		height: 100%;
		min-height: 0; /* important for flex scrolling */
	}

	.viewer {
		flex: 1;
		background: #eee;
	}
</style>
