<script lang="ts">
	import { images } from '$lib/core/projectStore';
	import DewarpTool, { type DewarpMesh } from './DewarpTool.svelte';
	import DewarpToolOSD from './DewarpToolOSD.svelte';
	import PrepareItemCell from '../PrepareMode/PrepareItemCell.svelte';

	/* -------------------------------------------------
	   Local State
	------------------------------------------------- */

	let selectedId: string | null = null;

	$: imageList = $images;

	$: selectedImage = selectedId && imageList.find((img) => img.id === selectedId);

	/* -------------------------------------------------
	   Selection
	------------------------------------------------- */

	function selectImage(id: string) {
		selectedId = id;
	}

	/* -------------------------------------------------
	   STUB: Future Dewarp Handler
	------------------------------------------------- */

	async function runDewarp(imageId: string, mesh: DewarpMesh) {
		console.group('DEWARP STUB');
		console.log('Image:', imageId);
		console.log('Mesh:', mesh);
		console.groupEnd();

		// 🔹 Future implementation will:
		// - Generate remap matrices
		// - Produce flattened derivative
		// - Store derivation
		// - Downgrade later stages
	}

	function handleConfirm(mesh: DewarpMesh) {
		if (!selectedImage) return;
		runDewarp(selectedImage.id, mesh);
	}

	function handleReset() {
		console.log('Mesh reset (stub)');
	}
</script>

<div class="layout">
	<!-- Sidebar -->
	<div class="sidebar">
		{#each imageList as image}
			<div
				class="item {selectedId === image.id ? 'selected' : ''}"
				on:click={() => selectImage(image.id)}
			>
				<PrepareItemCell
					{image}
					selected={selectedId === image.id}
					onSelect={() => selectImage(image.id)}
				/>
			</div>
		{/each}
	</div>

	<!-- Main -->
	<div class="workspace">
		{#if selectedImage}
			<!-- <DewarpTool
				imageUrl={selectedImage.runtimeUri}
				existingMesh={null}
				onConfirm={handleConfirm}
				onReset={handleReset}
			/> -->
			<DewarpToolOSD
				imageUrl={selectedImage.runtimeUri ?? selectedImage.originalUri ?? selectedImage.uri}
				rows={8}
				cols={6}
				onConfirm={(mesh) => {
					console.log('DEWARP STUB', selectedImage.id, mesh);
				}}
			/>
		{:else}
			<div class="empty">Select a page to test dewarping</div>
		{/if}
	</div>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 280px 1fr;
		height: 100%;
	}

	.sidebar {
		border-right: 1px solid rgba(0, 0, 0, 0.08);
		overflow-y: auto;
		padding: 0.5rem;
	}

	.workspace {
		position: relative;
		background: #000;
	}

	.item {
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 6px;
	}

	.item.selected {
		background: rgba(76, 159, 254, 0.15);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #666;
	}
</style>
