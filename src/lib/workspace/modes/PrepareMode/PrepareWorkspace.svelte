<script lang="ts">
	import { images } from '$lib/domain/project/projectStore';
	import ImagePreparationCanvas from './ImagePreparationCanvas.svelte';
	import PreparationToolbar from './PreparationToolbar.svelte';

	let selectedId: string | null = null;

	$: selectedImage = $images.find((img) => img.id === selectedId) ?? null;

	function selectImage(id: string) {
		selectedId = id;
	}
</script>

<div class="prepare-layout">
	<div class="sidebar">
		{#each $images as img}
			<button class:selected={img.id === selectedId} on:click={() => selectImage(img.id)}>
				{img.id}
			</button>
		{/each}
	</div>

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
	}

	.sidebar {
		width: 220px;
		border-right: 1px solid rgba(0, 0, 0, 0.08);
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sidebar button {
		all: unset;
		padding: 0.5rem;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.sidebar button.selected {
		background: rgba(0, 0, 0, 0.05);
		font-weight: 600;
	}

	.workspace {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.placeholder {
		padding: 2rem;
		color: #6b7280;
	}
</style>
