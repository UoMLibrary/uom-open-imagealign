<script lang="ts">
	import ImageThumbnail from '$lib/components/ImageThumbnail.svelte';
	import {
		imagesById,
		setGroupBaseImage,
		removeImageFromGroup,
		removeGroup,
		addImageToGroup
	} from '$lib/stores/projectStore';

	import { ungroupedImageIds } from '$lib/stores/imageVisibility';
	import type { ImageGroup } from '$lib/types/project';

	export let group: ImageGroup;

	function makeBase(imageId: string) {
		if (imageId === group.baseImageId) return;
		setGroupBaseImage(group.id, imageId);
	}

	function removeImage(imageId: string) {
		removeImageFromGroup(group.id, imageId);
	}

	function ungroup() {
		removeGroup(group.id);
	}

	// 🔑 new
	function addImage(imageId: string) {
		addImageToGroup(group.id, imageId);
	}
</script>

<div class="editor">
	<h4>Base image</h4>

	<div class="base">
		{#if $imagesById[group.baseImageId]}
			<ImageThumbnail
				src={$imagesById[group.baseImageId].uri}
				label={$imagesById[group.baseImageId].label}
			/>
		{/if}
	</div>

	<h4>Group images</h4>

	<div class="variants">
		{#each group.imageIds as id}
			{#if $imagesById[id]}
				<div class="variant" class:base={id === group.baseImageId}>
					<ImageThumbnail src={$imagesById[id].uri} label={$imagesById[id].label} />

					<div class="actions">
						{#if id !== group.baseImageId}
							<button on:click|stopPropagation={() => makeBase(id)}> Set as base </button>
						{:else}
							<span class="base-label">Base</span>
						{/if}

						<button class="danger" on:click|stopPropagation={() => removeImage(id)}>
							Remove
						</button>
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<!-- 🔑 NEW SECTION -->
	{#if $ungroupedImageIds.length > 0}
		<h4>Add images to group</h4>

		<div class="variants addable">
			{#each $ungroupedImageIds as id}
				{#if $imagesById[id]}
					<div class="variant add" on:click={() => addImage(id)}>
						<ImageThumbnail src={$imagesById[id].uri} label={$imagesById[id].label} />
						<span class="action">Add</span>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<div class="group-actions">
		<button class="danger" on:click={ungroup}> Ungroup </button>
	</div>
</div>

<style>
	/* existing styles unchanged */

	.addable {
		opacity: 0.85;
	}

	.variant.add {
		cursor: pointer;
		border: 1px dashed #bbb;
	}

	.variant.add:hover {
		background: #f5faff;
	}

	.variant.add .action {
		position: absolute;
		bottom: 4px;
		left: 4px;
		right: 4px;
		font-size: 0.7rem;
		text-align: center;
		background: rgba(255, 255, 255, 0.9);
		padding: 2px;
		border-radius: 2px;
	}
</style>
