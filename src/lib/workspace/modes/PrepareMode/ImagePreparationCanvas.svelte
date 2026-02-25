<script lang="ts">
	import CropRectangle from './CropRectangle.svelte';
	import CrosshairGuide from './CrosshairGuide.svelte';
	import RotationControls from './RotationControls.svelte';

	import { updateImagePreparation } from '$lib/core/projectStore';

	export let selectedImage;

	/* -------------------------------------------------
	   LOCAL UI STATE (not persisted until confirm)
	------------------------------------------------- */

	let rotation = 0;
	let rect = { x: 0, y: 0, width: 1, height: 1 };
	let crosshair = { x: 0.5, y: 0.5 };

	let isDirty = false;

	/* -------------------------------------------------
	   Sync UI state when selectedImage changes
	------------------------------------------------- */

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

		isDirty = false;
	}

	/* -------------------------------------------------
	   Helpers
	------------------------------------------------- */

	function clampRect(r) {
		const x = Math.max(0, Math.min(1, r.x));
		const y = Math.max(0, Math.min(1, r.y));
		const width = Math.max(0, Math.min(1 - x, r.width));
		const height = Math.max(0, Math.min(1 - y, r.height));

		return { x, y, width, height };
	}

	function onRectChange(next) {
		rect = clampRect(next);
		isDirty = true;
	}

	function onRotationChange(next) {
		rotation = next;
		isDirty = true;
	}

	/* -------------------------------------------------
	   Confirm (domain transition)
	------------------------------------------------- */

	async function confirmPreparation() {
		if (!selectedImage) return;

		const preparation = {
			rect: clampRect(rect),
			rotation
		};

		await updateImagePreparation(selectedImage.id, preparation);

		isDirty = false;
	}
</script>

<div class="canvas-wrapper">
	<div class="viewport">
		<!-- IMAGE FRAME -->
		<div class="image-frame">
			<div class="rotated-layer" style="transform: rotate({rotation}deg);">
				<img src={selectedImage.runtimeUri ?? selectedImage.source.uri} alt="" />
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

	{#if isDirty}
		<button on:click={confirmPreparation}> Confirm Geometry </button>
	{/if}

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
