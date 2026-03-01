<script lang="ts">
	import { onMount } from 'svelte';

	/* -------------------------------------------------
	   Types
	------------------------------------------------- */

	export type MeshPoint = {
		x: number; // normalised 0..1
		y: number; // normalised 0..1
	};

	export type DewarpMesh = {
		rows: number;
		cols: number;
		points: MeshPoint[];
		version: 1;
		method: 'bspline-grid';
	};

	/* -------------------------------------------------
	   Props
	------------------------------------------------- */

	export let imageUrl: string;
	export let existingMesh: DewarpMesh | null = null;

	export let rows = 8;
	export let cols = 6;

	// Svelte 5 callback props
	export let onConfirm: (mesh: DewarpMesh) => void;
	export let onReset: () => void;

	/* -------------------------------------------------
	   Local State
	------------------------------------------------- */

	let imgEl: HTMLImageElement;
	let container: HTMLDivElement;

	let points: MeshPoint[] = [];
	let draggingIndex: number | null = null;

	/* -------------------------------------------------
	   Initialise Mesh
	------------------------------------------------- */

	function createDefaultGrid(r: number, c: number): MeshPoint[] {
		const pts: MeshPoint[] = [];
		for (let row = 0; row < r; row++) {
			for (let col = 0; col < c; col++) {
				pts.push({
					x: col / (c - 1),
					y: row / (r - 1)
				});
			}
		}
		return pts;
	}

	$: if (existingMesh) {
		points = [...existingMesh.points];
		rows = existingMesh.rows;
		cols = existingMesh.cols;
	} else {
		points = createDefaultGrid(rows, cols);
	}

	/* -------------------------------------------------
	   Pointer Handling
	------------------------------------------------- */

	function getNormalisedCoords(event: PointerEvent) {
		const rect = container.getBoundingClientRect();
		return {
			x: (event.clientX - rect.left) / rect.width,
			y: (event.clientY - rect.top) / rect.height
		};
	}

	function pointerDown(index: number) {
		return (event: PointerEvent) => {
			draggingIndex = index;
			(event.target as HTMLElement).setPointerCapture(event.pointerId);
		};
	}

	function pointerMove(event: PointerEvent) {
		if (draggingIndex === null) return;

		const { x, y } = getNormalisedCoords(event);

		points[draggingIndex] = {
			x: Math.min(1, Math.max(0, x)),
			y: Math.min(1, Math.max(0, y))
		};

		points = [...points];
	}

	function pointerUp() {
		draggingIndex = null;
	}

	/* -------------------------------------------------
	   Confirm / Reset
	------------------------------------------------- */

	function confirm() {
		const mesh: DewarpMesh = {
			rows,
			cols,
			points,
			version: 1,
			method: 'bspline-grid'
		};

		onConfirm?.(mesh);
	}

	function reset() {
		points = createDefaultGrid(rows, cols);
		onReset?.();
	}
</script>

<div class="wrapper" bind:this={container} on:pointermove={pointerMove} on:pointerup={pointerUp}>
	<img bind:this={imgEl} src={imageUrl} alt="" draggable="false" />

	<svg>
		<!-- Draw grid lines -->
		{#each Array(rows) as _, r}
			{#each Array(cols - 1) as _, c}
				{@const i = r * cols + c}
				{@const j = r * cols + c + 1}
				<line
					class="line"
					x1={points[i].x * 100 + '%'}
					y1={points[i].y * 100 + '%'}
					x2={points[j].x * 100 + '%'}
					y2={points[j].y * 100 + '%'}
				/>
			{/each}
		{/each}

		{#each Array(cols) as _, c}
			{#each Array(rows - 1) as _, r}
				{@const i = r * cols + c}
				{@const j = (r + 1) * cols + c}
				<line
					class="line"
					x1={points[i].x * 100 + '%'}
					y1={points[i].y * 100 + '%'}
					x2={points[j].x * 100 + '%'}
					y2={points[j].y * 100 + '%'}
				/>
			{/each}
		{/each}

		<!-- Points -->
		{#each points as pt, i}
			<circle
				class="point"
				cx={pt.x * 100 + '%'}
				cy={pt.y * 100 + '%'}
				r="6"
				on:pointerdown={pointerDown(i)}
			/>
		{/each}
	</svg>

	<div class="toolbar">
		<button on:click={reset}>Reset Mesh</button>
		<button on:click={confirm}>Confirm Dewarp</button>
	</div>
</div>

<style>
	.wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #111;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		user-select: none;
		pointer-events: none;
	}

	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.point {
		fill: #4c9ffe;
		stroke: white;
		stroke-width: 1;
		cursor: grab;
	}

	.point:active {
		cursor: grabbing;
	}

	.line {
		stroke: rgba(255, 255, 255, 0.4);
		stroke-width: 1;
	}

	.toolbar {
		position: absolute;
		top: 12px;
		right: 12px;
		display: flex;
		gap: 0.5rem;
		z-index: 10;
	}

	button {
		background: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
	}
</style>
