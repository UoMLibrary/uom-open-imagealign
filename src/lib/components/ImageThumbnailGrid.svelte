<script lang="ts">
	import ImageThumbnail from './ImageThumbnail.svelte';
	import type { ImageSource } from '$lib/types/project';
	import { images } from '$lib/stores/projectStore';
</script>

<div class="grid">
	{#each $images as image (image.id)}
		<ImageThumbnail src={image.uri} label={image.label} />
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
