<script lang="ts">
	import ImageThumbnail from './ImageThumbnail.svelte';
	import type { ImageSource } from '$lib/types/project';

	export let images: ImageSource[] = [];
</script>

<div class="grid">
	{#each images as img (img.id)}
		<ImageThumbnail src={img.uri} label={img.label} />
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
