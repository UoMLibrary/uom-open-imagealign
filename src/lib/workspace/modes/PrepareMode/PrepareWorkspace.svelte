<script lang="ts">
	import { images, project, updateProjectUI } from '$lib/core/projectStore';
	import { get } from 'svelte/store';
	import Sidebar from '$lib/ui/app/SidePanel.svelte';
	import ImagePreparationCanvas from './ImagePreparationCanvas.svelte';
	import PreparationToolbar from './PreparationToolbar.svelte';

	// DEBUG
	// console.log('Images in store:', get(images));

	let selectedId: string | null = null;
	let sidebarOpen = true;

	/* ------------------------------------------------
	   Derive selected image
	------------------------------------------------ */

	$: selectedImage = $images.find((img) => img.id === selectedId) ?? null;

	/* ------------------------------------------------
	   Initialise from project.ui or fallback
	------------------------------------------------ */

	$: {
		if ($images.length === 0) {
			selectedId = null;
		} else if (!selectedId) {
			const last = $project.ui?.lastSelectedImageId;

			if (last && $images.some((i) => i.id === last)) {
				selectedId = last;
			} else {
				selectedId = $images[0].id;
			}
		}
	}

	/* ------------------------------------------------
	   Selection handler
	------------------------------------------------ */

	function selectImage(id: string) {
		selectedId = id;

		updateProjectUI({
			lastSelectedImageId: id
		});
	}
</script>

<div class="prepare-layout">
	<Sidebar side="left" bind:open={sidebarOpen} width={260}>
		<svelte:fragment slot="header">
			<div class="panel-title">Images</div>
		</svelte:fragment>

		{#each $images as img}
			<button class:selected={img.id === selectedId} on:click={() => selectImage(img.id)}>
				{img.label ?? img.id}
			</button>
		{/each}
	</Sidebar>

	<div class="workspace">
		{#if selectedImage}
			<ImagePreparationCanvas {selectedImage} />
			<PreparationToolbar {selectedImage} />
		{:else}
			<div class="placeholder">Select an image to prepare</div>
		{/if}
	</div>
</div>

<style>
	.prepare-layout {
		display: flex;
		height: 100%;
		min-height: 0; /* important for flex scrolling */
	}

	.workspace {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0; /* prevents overflow issues */
	}

	button {
		all: unset;
		display: block;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #374151;
	}

	button:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	button.selected {
		background: rgba(0, 0, 0, 0.06);
		font-weight: 600;
		color: #111827;
	}

	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #6b7280;
		padding: 0.5rem 0.75rem;
	}

	.placeholder {
		padding: 2rem;
		color: #6b7280;
	}
</style>
