<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let rect = {
		x: 0.1,
		y: 0.1,
		width: 0.8,
		height: 0.8
	};

	const dispatch = createEventDispatcher();

	let container: HTMLDivElement;
	let draggingCorner: string | null = null;

	function startDrag(corner: string) {
		draggingCorner = corner;
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', stopDrag);
	}

	function onMove(e: PointerEvent) {
		if (!draggingCorner) return;

		const bounds = container.getBoundingClientRect();

		const nx = (e.clientX - bounds.left) / bounds.width;
		const ny = (e.clientY - bounds.top) / bounds.height;

		let next = { ...rect };

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

	function stopDrag() {
		draggingCorner = null;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', stopDrag);
	}
</script>

<div class="overlay" bind:this={container}>
	<div
		class="rectangle"
		style="
			left: {rect.x * 100}%;
			top: {rect.y * 100}%;
			width: {rect.width * 100}%;
			height: {rect.height * 100}%;
		"
	/>

	<!-- 4 corners -->
	<div
		class="handle tl"
		style="left:{rect.x * 100}%; top:{rect.y * 100}%"
		on:pointerdown={() => startDrag('top-left')}
	/>
	<div
		class="handle tr"
		style="left:{(rect.x + rect.width) * 100}%; top:{rect.y * 100}%"
		on:pointerdown={() => startDrag('top-right')}
	/>
	<div
		class="handle bl"
		style="left:{rect.x * 100}%; top:{(rect.y + rect.height) * 100}%"
		on:pointerdown={() => startDrag('bottom-left')}
	/>
	<div
		class="handle br"
		style="left:{(rect.x + rect.width) * 100}%; top:{(rect.y + rect.height) * 100}%"
		on:pointerdown={() => startDrag('bottom-right')}
	/>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
	}

	.rectangle {
		position: absolute;
		border: 2px solid red;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.2);
		pointer-events: none;
	}

	.handle {
		position: absolute;
		width: 12px;
		height: 12px;
		background: red;
		transform: translate(-50%, -50%);
		cursor: pointer;
	}
</style>
