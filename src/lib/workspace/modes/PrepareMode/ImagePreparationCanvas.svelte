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
	import {
		regeneratePreparedWorking,
		regenerateCanonicalNormalised
	} from '$lib/domain/image/ImageDerivationStore';
	import { setImageStage } from '$lib/domain/project/workflow';
	import { invalidatePrepared } from '$lib/domain/image/ImageDerivationStore';

	export let selectedImage;

	let rotation = 0;
	let rect = { x: 0, y: 0, width: 1, height: 1 };
	let crosshair = { x: 0.5, y: 0.5 };

	let lastRotation = rotation;
	let lastRect = JSON.stringify(rect);

	// TODO: this is a bit hacky - we want to trigger confirmation when geometry changes, but not on initial load. We can probably improve this logic by tracking "dirty" state or similar.
	$: {
		const rectString = JSON.stringify(rect);
		const geometryChanged = rotation !== lastRotation || rectString !== lastRect;

		if (geometryChanged) {
			lastRotation = rotation;
			lastRect = rectString;

			if (selectedImage.workflow?.stage !== 'ingested') {
				invalidatePrepared(selectedImage.hashes.contentHash);
				setImageStage(selectedImage.id, 'ingested');
			}
		}
	}

	$: needsConfirmation = selectedImage.workflow?.stage === 'ingested';

	async function confirmPreparation() {
		const { hashes, preparation } = selectedImage;

		if (!hashes?.contentHash || !preparation) {
			console.error('Missing data for regeneration');
			return;
		}

		// 1️⃣ Generate prepared working image (for Align)
		await regeneratePreparedWorking(hashes.contentHash, preparation);

		// 2️⃣ Generate canonical (for pHash / grouping)
		await regenerateCanonicalNormalised(hashes.contentHash, preparation);

		setImageStage(selectedImage.id, 'prepared');
	}

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

	async function save() {
		if (!selectedImage) return;

		await updateImagePreparation(selectedImage.id, {
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

	{#if needsConfirmation}
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
