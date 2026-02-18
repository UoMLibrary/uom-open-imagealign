<script lang="ts">
	import CornerHandles from './CornerHandles.svelte';
	import RotationControls from './RotationControls.svelte';
	import { updateImageTransform } from '$lib/domain/project/projectStore';

	export let selectedImage;

	let rotation = selectedImage.transform?.rotation ?? 0;

	let corners = selectedImage.transform?.corners ?? [
		{ x: 0.1, y: 0.1 },
		{ x: 0.9, y: 0.1 },
		{ x: 0.9, y: 0.9 },
		{ x: 0.1, y: 0.9 }
	];

	function onCornersChange(newCorners) {
		corners = newCorners;
		save();
	}

	function onRotationChange(newRotation) {
		rotation = newRotation;
		save();
	}

	function save() {
		updateImageTransform(selectedImage.id, {
			corners,
			rotation
		});
	}
</script>

<div class="canvas-wrapper">
	<div class="image-container" style="transform: rotate({rotation}deg);">
		<img src={selectedImage.uri} alt="" />

		<CornerHandles {corners} on:change={(e) => onCornersChange(e.detail)} />
	</div>

	<RotationControls {rotation} on:change={(e) => onRotationChange(e.detail)} />
</div>

<style>
	.canvas-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.image-container {
		position: relative;
		display: inline-block;
	}

	img {
		max-width: 80vw;
		max-height: 70vh;
		display: block;
	}
</style>
