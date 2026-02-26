<script lang="ts">
	import CropRectangle from './CropRectangle.svelte';
	import CrosshairGuide from './CrosshairGuide.svelte';
	import RotationControls from './RotationControls.svelte';

	import { setImageStage } from '$lib/core/workflow';
	import { updateImagePreparation } from '$lib/core/projectStore';

	export let selectedImage;

	/* -------------------------------------------------
	   LOCAL UI STATE (not persisted until confirm)
	------------------------------------------------- */

	let rotation = 0;
	let rect = { x: 0, y: 0, width: 1, height: 1 };
	let crosshair = { x: 0.5, y: 0.5 };

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

	function downgradeIfNeeded() {
		if (!selectedImage) return;

		// Only downgrade if currently prepared or beyond
		if (selectedImage.workflow.stage !== 'ingested') {
			setImageStage(selectedImage.id, 'ingested');
		}
	}

	function onRectChange(next) {
		rect = clampRect(next);
		downgradeIfNeeded();
	}

	function onRotationChange(next) {
		rotation = next;
		downgradeIfNeeded();
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

		// Advance stage explicitly
		setImageStage(selectedImage.id, 'prepared');
	}

	async function resetPreparation() {
		if (!selectedImage) return;

		let prep = {
			rect: { x: 0, y: 0, width: 1, height: 1 },
			rotation: 0
		};

		// Clear persisted preparation
		await updateImagePreparation(selectedImage.id, prep);

		// Downgrade workflow stage
		setImageStage(selectedImage.id, 'ingested');

		// Reset local UI state
		rotation = prep.rotation;
		rect = prep.rect;
	}
</script>

<div class="canvas-wrapper">
	<div class="viewport">
		<div class="image-frame">
			<div class="rotated-layer" style="transform: rotate({rotation}deg);">
				<img src={selectedImage.runtimeUri ?? selectedImage.source.uri} alt="" />
			</div>

			<div class="crop-layer">
				<CropRectangle {rect} on:change={(e) => onRectChange(e.detail)} />
			</div>
		</div>

		<div class="crosshair-layer">
			<CrosshairGuide
				fullSize
				x={crosshair.x}
				y={crosshair.y}
				on:change={(e) => (crosshair = e.detail)}
			/>
		</div>

		<!-- Button controlled by workflow stage -->
		{#if selectedImage}
			<div class="cta-layer">
				{#if selectedImage.workflow.stage !== 'prepared'}
					<button class="cta confirm" on:click={confirmPreparation}> Confirm Geometry </button>
				{:else}
					<button class="cta reset" on:click={resetPreparation}> Reset Geometry </button>
				{/if}
			</div>
		{/if}
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
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
		overflow: hidden;
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

	/* CTA button layer (workflow dependent) */
	.cta-layer {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 20;
		display: flex;
	}

	.cta {
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.cta.confirm {
		background: #2563eb;
		color: white;
	}

	.cta.confirm:hover {
		background: #1e4fd6;
	}

	.cta.reset {
		background: #f3f4f6;
		color: #333;
		border: 1px solid #d1d5db;
	}

	.cta.reset:hover {
		background: #e5e7eb;
	}
</style>
