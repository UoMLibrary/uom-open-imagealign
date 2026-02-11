<script lang="ts">
	import ImageThumbnailGrid from '$lib/components/ImageThumbnailGrid.svelte';
	import type { ImageGroup } from '$lib/types/project';

	export let group: ImageGroup;
</script>

<div class="editor">
	<h4>Base image</h4>
	<ImageThumbnailGrid visibleImageIds={[group.baseImageId]} />

	<h4>Group images</h4>
	<ImageThumbnailGrid visibleImageIds={group.imageIds} />

	<div class="actions">
		<button>Change base</button>
		<button>Reorder</button>
		<button class="danger">Ungroup</button>
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

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.danger {
		margin-left: auto;
		color: #a00;
	}
</style>
