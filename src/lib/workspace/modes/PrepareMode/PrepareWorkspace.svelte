<script lang="ts">
	import { images, project, updateProjectUI } from '$lib/core/projectStore';
	import { get } from 'svelte/store';
	import Sidebar from '$lib/ui/app/SidePanel.svelte';
	import ImagePreparationCanvas from './ImagePreparationCanvas.svelte';
	import PreparationToolbar from './PreparationToolbar.svelte';
	import PrepareItemCell from './PrepareItemCell.svelte';
	import FilterSegment from '$lib/ui/shared/ui/FilterSegment.svelte';

	const filterOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'confirmed', label: '✓' },
		{ value: 'unconfirmed', label: '✕' }
	];

	type FilterMode = 'all' | 'confirmed' | 'unconfirmed';
	let filter: FilterMode = 'all';

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

	/* ------------------------------------------------
 		Filtering logic for preparation status 
		(placeholder, replace with actual logic)
	------------------------------------------------ */

	$: filteredImages =
		filter === 'all'
			? $images
			: filter === 'confirmed'
				? $images.filter(isConfirmed)
				: $images.filter((img) => !isConfirmed(img));

	function isConfirmed(image: (typeof $images)[0]) {
		// Placeholder logic for determining if an image is confirmed
		// Replace with actual logic based on your application's needs
		return true; // Assume all images are confirmed for now
	}
</script>

<div class="prepare-layout">
	<Sidebar side="left" bind:open={sidebarOpen} width={280}>
		<svelte:fragment slot="header">
			<div class="panel-header">
				<div class="header-row">
					<div class="panel-title">Images</div>

					<FilterSegment
						options={filterOptions}
						value={filter}
						onChange={(v) => (filter = v as FilterMode)}
					/>
				</div>
			</div>
		</svelte:fragment>

		<div class="image-list">
			{#each filteredImages as img}
				<PrepareItemCell
					image={img}
					selected={img.id === selectedId}
					confirmed={isConfirmed(img)}
					onSelect={() => selectImage(img.id)}
				/>
			{/each}
		</div>
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

	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #6b7280;
		padding: 0.5rem 0.75rem;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.placeholder {
		padding: 2rem;
		color: #6b7280;
	}
	.panel-header {
		padding: 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		margin-bottom: 0.5rem;
	}

	.image-list {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
	}
</style>
