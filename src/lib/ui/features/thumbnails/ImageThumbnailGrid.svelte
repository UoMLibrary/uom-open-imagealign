<script lang="ts">
	import ImageThumbnail from './ImageThumbnail.svelte';
	import { images } from '$lib/core/projectStore';

	/**
	 * IDs of images to render in this grid.
	 * The grid does not decide membership; it only renders what it is given.
	 */
	export let visibleImageIds: string[] = [];
</script>

<div class="grid">
	{#each $images.filter((img) => visibleImageIds.includes(img.id)) as image (image.id)}
		<ImageThumbnail
			contentHash={image.hashes.contentHash}
			fallbackSrc={image.uri}
			label={image.label}
			mode="thumb"
			debugCompare={true}
		/>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.75rem;
		padding: 1rem;
	}
</style>
