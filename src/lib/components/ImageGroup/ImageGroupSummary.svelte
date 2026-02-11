<script lang="ts">
	import ImageThumbnail from '$lib/components/ImageThumbnail.svelte';
	import { imagesById } from '$lib/domain/project/projectStore';
	import type { ImageGroup } from '$lib/types/project';

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
