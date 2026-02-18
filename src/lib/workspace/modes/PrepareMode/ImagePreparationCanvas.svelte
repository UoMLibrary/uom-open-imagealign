<!-- 
	Raw Image
		↓
	User defines region + rotation
		↓
	Normalised Image Generated
		↓
	Thumbnail Generated
		↓
	pHash Generated
		↓
	Visual Profile Generated 
-->

<script lang="ts">
	import CropRectangle from './CropRectangle.svelte';
	import CrosshairGuide from './CrosshairGuide.svelte';
	import RotationControls from './RotationControls.svelte';
	import { updateImagePreparation } from '$lib/domain/project/projectStore';

	export let selectedImage;

	let rotation = 0;
	let rect = { x: 0, y: 0, width: 1, height: 1 };
	let crosshair = { x: 0.5, y: 0.5 };

	/* -----------------------------
	   Sync from selectedImage
	----------------------------- */

	$: if (selectedImage) {
		if (selectedImage.preparation) {
			rotation = selectedImage.preparation.rotation ?? 0;
			rect = selectedImage.preparation.rect ?? {
				x: 0,
				y: 0,
				width: 1,
				height: 1
			};
		} else {
			rotation = 0;
			rect = { x: 0, y: 0, width: 1, height: 1 };
		}
	}

	/* -----------------------------
	   Helpers
	----------------------------- */

	function clampRect(r) {
		const x = Math.max(0, Math.min(1, r.x));
		const y = Math.max(0, Math.min(1, r.y));
		const width = Math.max(0, Math.min(1 - x, r.width));
		const height = Math.max(0, Math.min(1 - y, r.height));

		return { x, y, width, height };
	}

	function save() {
		if (!selectedImage) return;

		updateImagePreparation(selectedImage.id, {
			rect: clampRect(rect),
			rotation
		});
	}

	function onRectChange(next) {
		rect = clampRect(next);
		save();
	}

	function onRotationChange(next) {
		rotation = next;
		save();
	}
</script>

<div class="canvas-wrapper">
	<div class="viewport">
		<!-- IMAGE FRAME (image-sized) -->
		<div class="image-frame">
			<div class="rotated-layer" style="transform: rotate({rotation}deg);">
				<img src={selectedImage.uri} alt="" />
			</div>

			<div class="crop-layer">
				<CropRectangle {rect} on:change={(e) => onRectChange(e.detail)} />
			</div>
		</div>

		<!-- FULL VIEWPORT CROSSHAIR -->
		<div class="crosshair-layer">
			<CrosshairGuide
				fullSize
				x={crosshair.x}
				y={crosshair.y}
				on:change={(e) => (crosshair = e.detail)}
			/>
		</div>
	</div>

	<RotationControls {rotation} on:change={(e) => onRotationChange(e.detail)} />
</div>

<style>
	.canvas-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.viewport {
		position: relative; /* important */
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
	}

	.image-frame {
		position: relative;
		display: inline-block;
		z-index: 1;
	}

	.crop-layer {
		position: absolute;
		inset: 0;
		z-index: 5;
		pointer-events: none;
	}

	.crop-layer :global(.overlay) {
		pointer-events: auto;
	}

	/* NEW */
	.crosshair-layer {
		position: absolute;
		inset: 0;
		z-index: 10;
		pointer-events: none;
	}

	.rotated-layer {
		transform-origin: center center;
		z-index: 1;
	}

	img {
		display: block;
		max-width: 80vw;
		max-height: 70vh;
		user-select: none;
	}
</style>
