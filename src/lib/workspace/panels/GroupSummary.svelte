<script lang="ts">
	import ImageThumbnail from '$lib/ui/features/thumbnails/ImageThumbnail.svelte';
	import { imagesById } from '$lib/core/projectStore';
	import type { ImageGroup } from '$lib/core/types';

	export let group: ImageGroup;

	$: baseImage = $imagesById[group.baseImageId];
</script>

<div class="summary">
	<ImageThumbnail src={baseImage?.uri} label={baseImage?.label} />

	<div class="meta">
		<div class="count">
			{group.imageIds.length} images
		</div>
		<div class="base">
			Base: {baseImage?.label}
		</div>
	</div>
</div>

<style>
	.summary {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		cursor: pointer;
	}

	.meta {
		display: flex;
		flex-direction: column;
		font-size: 0.8rem;
		color: #555;
	}
</style>
