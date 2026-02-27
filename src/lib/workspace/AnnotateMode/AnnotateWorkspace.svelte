<script lang="ts">
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import ViewerShell from './Viewer/ViewerShell.svelte';

	let LeftPanelOpen = true;
	let RightPanelOpen = true;
</script>

<div class="prepare-layout">
	<SidePanel side="left" bind:open={LeftPanelOpen}>side panel content</SidePanel>
	<div class="viewer">
		<!-- {#if $activePair} -->
		<!-- {#key $activePair.id} -->
		<!-- <ViewerShell imageA={$activePair.imageAUrl} imageB={$activePair.imageBUrl} {session} /> -->
		<ViewerShell imageA="test/photo1.png" imageB="test/photo2.png" />
		<!-- {/key} -->
		<!-- {/if} -->
	</div>
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
