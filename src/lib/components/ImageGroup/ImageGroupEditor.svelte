<script lang="ts">
	import ImageThumbnail from '$lib/components/ImageThumbnail.svelte';
	import { imagesById, setGroupBaseImage } from '$lib/stores/projectStore';
	import type { ImageGroup } from '$lib/types/project';

	export let group: ImageGroup;

	function makeBase(imageId: string) {
		if (imageId === group.baseImageId) return;
		setGroupBaseImage(group.id, imageId);
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
				<div class="variant" class:base={id === group.baseImageId} on:click={() => makeBase(id)}>
					<ImageThumbnail src={$imagesById[id].uri} label={$imagesById[id].label} />

					{#if id !== group.baseImageId}
						<span class="action">Set as base</span>
					{:else}
						<span class="action base-label">Base</span>
					{/if}
				</div>
			{/if}
		{/each}
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

	.variants {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.5rem;
	}

	.variant {
		position: relative;
		cursor: pointer;
	}

	.variant.base {
		outline: 2px solid #3b82f6;
	}

	.action {
		position: absolute;
		bottom: 4px;
		left: 4px;
		right: 4px;
		font-size: 0.7rem;
		text-align: center;
		background: rgba(255, 255, 255, 0.85);
		padding: 2px;
		border-radius: 2px;
	}

	.base-label {
		font-weight: 600;
	}
</style>
