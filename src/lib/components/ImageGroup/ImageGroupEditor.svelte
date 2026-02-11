<script lang="ts">
	import ImageThumbnail from '$lib/components/ImageThumbnail.svelte';
	import {
		imagesById,
		setGroupBaseImage,
		removeImageFromGroup,
		removeGroup
	} from '$lib/stores/projectStore';
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

	<div class="group-actions">
		<button class="danger" on:click={ungroup}> Ungroup </button>
	</div>
</div>

<style>
	.editor {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	h4 {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #666;
	}

	.base {
		max-width: 200px;
	}

	.variants {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.variant {
		position: relative;
		border: 1px solid #ddd;
		padding: 4px;
		border-radius: 2px;
	}

	.variant.base {
		outline: 2px solid #3b82f6;
	}

	.actions {
		display: flex;
		justify-content: space-between;
		gap: 0.25rem;
		margin-top: 4px;
		font-size: 0.7rem;
	}

	button {
		font-size: 0.7rem;
		padding: 2px 4px;
	}

	.danger {
		color: #a00;
	}

	.base-label {
		font-weight: 600;
		font-size: 0.7rem;
	}

	.group-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}
</style>
