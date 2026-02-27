<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	export let rect = {
		x: 0,
		y: 0,
		width: 1,
		height: 1
	};

	const dispatch = createEventDispatcher();

	let container: HTMLDivElement;

	let draggingCorner: string | null = null;
	let draggingBody = false;
	let dragOffset = { x: 0, y: 0 };

	/* -----------------------------
	   Start Drag Corner
	----------------------------- */
	function startDragCorner(corner: string) {
		draggingCorner = corner;
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', stopDrag);
	}

	/* -----------------------------
	   Start Drag Whole Rectangle
	----------------------------- */
	function startDragBody(e: PointerEvent) {
		e.stopPropagation();
		draggingBody = true;

		const bounds = container.getBoundingClientRect();

		const nx = (e.clientX - bounds.left) / bounds.width;
		const ny = (e.clientY - bounds.top) / bounds.height;

		dragOffset = {
			x: nx - rect.x,
			y: ny - rect.y
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', stopDrag);
	}

	/* -----------------------------
	   Move Logic
	----------------------------- */
	function onMove(e: PointerEvent) {
		const bounds = container.getBoundingClientRect();

		const nx = (e.clientX - bounds.left) / bounds.width;
		const ny = (e.clientY - bounds.top) / bounds.height;

		let next = { ...rect };

		/* ---- Drag whole rectangle ---- */
		if (draggingBody) {
			next.x = nx - dragOffset.x;
			next.y = ny - dragOffset.y;

			// clamp within bounds
			next.x = Math.max(0, Math.min(1 - rect.width, next.x));
			next.y = Math.max(0, Math.min(1 - rect.height, next.y));

			dispatch('change', next);
			return;
		}

		/* ---- Drag corners ---- */
		if (!draggingCorner) return;

		if (draggingCorner.includes('left')) {
			const right = rect.x + rect.width;
			next.x = Math.min(nx, right - 0.01);
			next.width = right - next.x;
		}

		if (draggingCorner.includes('right')) {
			next.width = Math.max(0.01, nx - rect.x);
		}

		if (draggingCorner.includes('top')) {
			const bottom = rect.y + rect.height;
			next.y = Math.min(ny, bottom - 0.01);
			next.height = bottom - next.y;
		}

		if (draggingCorner.includes('bottom')) {
			next.height = Math.max(0.01, ny - rect.y);
		}

		dispatch('change', next);
	}

	/* -----------------------------
	   Stop Drag
	----------------------------- */
	function stopDrag() {
		draggingCorner = null;
		draggingBody = false;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', stopDrag);
	}

	onDestroy(stopDrag);
</script>

<div class="overlay" bind:this={container}>
	<!-- Draggable rectangle body -->
	<div
		class="rectangle"
		style="
			left: {rect.x * 100}%;
			top: {rect.y * 100}%;
			width: {rect.width * 100}%;
			height: {rect.height * 100}%;
		"
		on:pointerdown={startDragBody}
	/>

	<!-- Corner Handles -->
	<div
		class="handle tl"
		style="left:{rect.x * 100}%; top:{rect.y * 100}%"
		on:pointerdown={() => startDragCorner('top-left')}
	/>
	<div
		class="handle tr"
		style="left:{(rect.x + rect.width) * 100}%; top:{rect.y * 100}%"
		on:pointerdown={() => startDragCorner('top-right')}
	/>
	<div
		class="handle bl"
		style="left:{rect.x * 100}%; top:{(rect.y + rect.height) * 100}%"
		on:pointerdown={() => startDragCorner('bottom-left')}
	/>
	<div
		class="handle br"
		style="left:{(rect.x + rect.width) * 100}%; top:{(rect.y + rect.height) * 100}%"
		on:pointerdown={() => startDragCorner('bottom-right')}
	/>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 5;
	}

	.rectangle {
		position: absolute;
		border: 2px solid #ef4444;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25);
		cursor: move;
	}

	.handle {
		position: absolute;
		width: 14px;
		height: 14px;
		background: #ef4444;
		border: 2px solid white;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		cursor: pointer;
		z-index: 6;
	}
</style>
