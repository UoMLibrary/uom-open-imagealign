<script lang="ts">
	import CropRectangle from './CropRectangle.svelte';
	import CrosshairGuide from './CrosshairGuide.svelte';
	import RotationControls from './RotationControls.svelte';
	import { updateImagePreparation } from '$lib/domain/project/projectStore';

	export let selectedImage;

	/* -----------------------------
	   Initial state from schema
	----------------------------- */

	let rotation = selectedImage.preparation?.rotation ?? 0;

	let rect = selectedImage.preparation
		? rectangleFromCorners(selectedImage.preparation.corners)
		: {
				x: 0.1,
				y: 0.1,
				width: 0.8,
				height: 0.8
			};

	let crosshair = { x: 0.5, y: 0.5 };

	/* -----------------------------
	   Helpers
	----------------------------- */

	function rectangleFromCorners(corners) {
		const [tl, tr, br, bl] = corners;

		return {
			x: tl.x,
			y: tl.y,
			width: tr.x - tl.x,
			height: bl.y - tl.y
		};
	}

	function cornersFromRectangle(
		r
	): [
		{ x: number; y: number },
		{ x: number; y: number },
		{ x: number; y: number },
		{ x: number; y: number }
	] {
		return [
			{ x: r.x, y: r.y }, // TL
			{ x: r.x + r.width, y: r.y }, // TR
			{ x: r.x + r.width, y: r.y + r.height }, // BR
			{ x: r.x, y: r.y + r.height } // BL
		];
	}

	function save() {
		updateImagePreparation(selectedImage.id, {
			corners: cornersFromRectangle(rect),
			rotation
		});
	}

	function onRectChange(next) {
		rect = next;
		save();
	}

	function onRotationChange(next) {
		rotation = next;
		save();
	}
</script>

<div class="canvas-wrapper">
	<div class="viewport">
		<!-- ROTATED IMAGE ONLY -->
		<div class="rotated-layer" style="transform: rotate({rotation}deg);">
			<img src={selectedImage.uri} alt="" />
		</div>

		<!-- NON-ROTATING CROP RECTANGLE -->
		<div class="crop-layer">
			<CropRectangle {rect} on:change={(e) => onRectChange(e.detail)} />
		</div>

		<!-- NON-ROTATING CROSSHAIR -->
		<CrosshairGuide
			fullSize
			x={crosshair.x}
			y={crosshair.y}
			on:change={(e) => (crosshair = e.detail)}
		/>
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
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}

	.rotated-layer {
		position: relative;
		z-index: 1;
		transform-origin: center center;
	}

	img {
		max-width: 80vw;
		max-height: 70vh;
		display: block;
		user-select: none;
	}

	.crop-layer {
		position: absolute;
		inset: 0;
		z-index: 5;
	}

	.crop-layer :global(.overlay) {
		pointer-events: auto;
	}

	.crosshair-overlay {
		z-index: 10;
	}
</style>
