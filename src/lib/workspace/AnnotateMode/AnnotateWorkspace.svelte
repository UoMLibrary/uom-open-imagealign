<script lang="ts">
	import { createAnnotationEditorSession } from './Viewer/annotationEditorSession';

	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import ViewerShell from './Viewer/ViewerShell.svelte';

	let session = createAnnotationEditorSession();

	let LeftPanelOpen = true;
	let RightPanelOpen = true;
</script>

<div class="prepare-layout">
	<SidePanel side="left" bind:open={LeftPanelOpen}>
		<div class="panel-header">
			<div class="header-row">
				<div class="panel-title">Groups</div>
			</div>
		</div>
	</SidePanel>
	<div class="viewer">
		<!-- {#if $activePair} -->
		<!-- {#key $activePair.id} -->
		<!-- <ViewerShell imageA={$activePair.imageAUrl} imageB={$activePair.imageBUrl} {session} /> -->
		<ViewerShell imageA="test/photo1.png" imageB="test/photo2.png" {session} />
		<!-- {/key} -->
		<!-- {/if} -->
	</div>
	<SidePanel side="right" bind:open={RightPanelOpen} width={420}>
		<div class="panel-header">
			<div class="header-row">
				<div class="panel-title">Annotations</div>
			</div>
		</div>
	</SidePanel>
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

	/* Shared SidePanel styles */
	.panel-header {
		padding: 0.4rem 0.75rem 0.4rem 1.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		line-height: 1; /* prevents vertical drift */
		margin: 0; /* remove bottom spacing */
	}
</style>
