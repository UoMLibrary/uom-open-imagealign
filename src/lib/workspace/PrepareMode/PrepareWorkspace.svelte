<script lang="ts">
	import { images, project, updateProjectUI } from '$lib/core/projectStore';
	import SidePanel from '$lib/ui/shared/ui/SidePanel.svelte';
	import ImagePreparationCanvas from './ImagePreparationPanel/ImagePreparationCanvas.svelte';
	import PreparationInfoBar from './PreparationInfoBar.svelte';
	import PrepareItemCell from './PrepareItemCell.svelte';
	import FilterSegment from '$lib/ui/shared/ui/FilterSegment.svelte';
	import { isStageAtOrBeyond } from '$lib/core/workflow';
	import type { WorkflowStage } from '$lib/core/workflow';

	const filterOptions = [
		{ value: 'all', label: 'All' },
		{ value: 'confirmed', label: '✓' },
		{ value: 'unconfirmed', label: '✕' }
	];

	type FilterMode = 'all' | 'confirmed' | 'unconfirmed';
	let filter: FilterMode = 'all';
	let selectedId: string | null = null;
	let SidePanelOpen = true;

	/* ------------------------------------------------
	   Derive selected image
	------------------------------------------------ */

	$: totalCount = $images.length;

	$: confirmedCount = $images.filter(isConfirmed).length;

	function getSelectedImage(images: typeof $images, id: string | null) {
		if (!id) return null;
		return images.find((img) => img.id === id) ?? null;
	}

	$: selectedImage = getSelectedImage($images, selectedId);

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
	$: filteredImages = filterImages($images, filter);

	function filterImages(images: typeof $images, mode: FilterMode) {
		switch (mode) {
			case 'all':
				return images;

			case 'confirmed':
				return images.filter(isConfirmed);

			case 'unconfirmed':
				return images.filter((img) => !isConfirmed(img));
		}
	}

	function isConfirmed(image: (typeof $images)[0]) {
		const stage = image.workflow?.stage as WorkflowStage | undefined;

		if (!stage) return false;

		return isStageAtOrBeyond(stage, 'prepared');
	}
</script>

<div class="prepare-layout">
	<SidePanel side="left" bind:open={SidePanelOpen} width={280}>
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

		<div class="panel-body">
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

			<div class="panel-footer {confirmedCount === totalCount && totalCount > 0 ? 'complete' : ''}">
				<span class="footer-label">Prepared</span>
				<span class="footer-count">
					{confirmedCount} / {totalCount}
				</span>
			</div>
		</div>
	</SidePanel>

	<div class="workspace">
		{#if selectedImage}
			<ImagePreparationCanvas {selectedImage} />
			<PreparationInfoBar {selectedImage} />
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

	.placeholder {
		padding: 2rem;
		color: #6b7280;
	}

	.panel-body {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.image-list {
		flex: 1;
		padding: 0.5rem 0.2rem 0.5rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
	}

	/* Footer styled to match header */
	.panel-footer {
		padding: 0.4rem 0.75rem;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		font-size: 0.72rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #6b7280;
		background: #fafafa;
	}

	.panel-footer.complete {
		color: #16a34a; /* green when complete */
		font-weight: 600;
	}

	.footer-label {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		opacity: 0.85;
	}

	.footer-count {
		font-variant-numeric: tabular-nums;
	}
</style>
