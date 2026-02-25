<script lang="ts">
	import { images, project, updateProjectUI } from '$lib/core/projectStore';
	import { get } from 'svelte/store';
	import Sidebar from '$lib/ui/app/SidePanel.svelte';
	import ImagePreparationCanvas from './ImagePreparationCanvas.svelte';
	import PreparationToolbar from './PreparationToolbar.svelte';
	import ImageThumbnail from '$lib/ui/features/thumbnails/ImageThumbnail.svelte';

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
				<div class="panel-title">Images</div>

				<div class="filter">
					<button class:selected={filter === 'all'} on:click={() => (filter = 'all')}> All </button>

					<button class:selected={filter === 'confirmed'} on:click={() => (filter = 'confirmed')}>
						Confirmed
					</button>

					<button
						class:selected={filter === 'unconfirmed'}
						on:click={() => (filter = 'unconfirmed')}
					>
						Unconfirmed
					</button>
				</div>
			</div>
		</svelte:fragment>

		<div class="image-list">
			{#each filteredImages as img}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="image-card {img.id === selectedId ? 'selected' : ''}"
					on:click={() => selectImage(img.id)}
				>
					<div class="thumb-wrapper">
						<ImageThumbnail
							contentHash={img.hashes?.contentHash}
							fallbackSrc={img.runtimeUri}
							label={undefined}
							mode="thumb"
						/>
					</div>

					<div class="meta">
						<div class="name">
							{img.label ?? img.id}
						</div>

						<div class="details">
							{img.dimensions?.width} × {img.dimensions?.height}
						</div>

						<div class="details muted">
							{img.sourceType}
						</div>
					</div>

					{#if isConfirmed(img)}
						<div class="badge">✓</div>
					{/if}
				</div>
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

	.filter {
		display: flex;
		gap: 0.25rem;
		background: #f3f4f6;
		padding: 0.25rem;
		border-radius: 8px;
	}

	.filter button {
		all: unset;
		flex: 1;
		text-align: center;
		font-size: 0.7rem;
		padding: 0.35rem 0;
		border-radius: 6px;
		cursor: pointer;
		color: #6b7280;
	}

	.filter button.selected {
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		color: #111827;
		font-weight: 600;
	}

	.image-list {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
	}

	.image-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 8px;
		cursor: pointer;
		position: relative;
		transition: background 0.15s ease;
	}

	.image-card:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.image-card.selected {
		background: rgba(0, 0, 0, 0.06);
	}

	.thumb-wrapper {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.thumb-wrapper :global(.thumb) {
		width: 100%;
		height: 100%;
	}

	.thumb-wrapper :global(.image-frame) {
		height: 100%;
		padding: 0;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		background: #f9fafb;
	}

	.thumb-wrapper :global(img) {
		object-fit: cover;
	}

	.meta {
		flex: 1;
		min-width: 0;
	}

	.name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.details {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.details.muted {
		opacity: 0.7;
	}

	.badge {
		position: absolute;
		right: 8px;
		top: 8px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #22c55e;
		color: white;
		font-size: 0.7rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
