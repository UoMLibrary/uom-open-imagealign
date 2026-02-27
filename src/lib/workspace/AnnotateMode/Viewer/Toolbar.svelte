<script>
	import PadlockToggle from '$lib/viewer/PadlockToggle.svelte';
	import { createEventDispatcher } from 'svelte';

	// TODO: This does not belong here
	let locked = true;

	function handleLockChange(e) {
		locked = e.detail.locked;
		// do something meaningful here
		console.log(locked ? 'Locked' : 'Unlocked');
	}

	export let currentMode = 'pan';
	export let overlayOpacity = 0.5;

	const dispatch = createEventDispatcher();

	function setMode(mode) {
		dispatch('modechange', mode);
	}

	function setOpacity(value) {
		dispatch('opacitychange', value);
	}

	function setA() {
		setOpacity(0);
	}

	function setB() {
		setOpacity(1);
	}
</script>

<div class="toolbar">
	<!-- Tool segments -->
	<div class="tools">
		<button class:active={currentMode === 'pan'} on:click={() => setMode('pan')}> Pan </button>

		<button class:active={currentMode === 'rectangle'} on:click={() => setMode('rectangle')}>
			Rectangle
		</button>

		<button class:active={currentMode === 'polygon'} on:click={() => setMode('polygon')}>
			Polygon
		</button>
	</div>

	<!-- Fade segment -->
	<div class="fade">
		<!-- <span class="doc">A</span> -->
		<button class="doc" on:click={setA} aria-label="Show image A only"> A </button>

		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			value={overlayOpacity}
			on:input={(e) => setOpacity(+e.target.value)}
		/>

		<button class="doc" on:click={setB} aria-label="Show image B only"> B </button>
	</div>

	<!-- Lock segment -->
	<div><PadlockToggle {locked} on:change={handleLockChange} /></div>
</div>

<style>
	/* ---------- Toolbar shell ---------- */

	.toolbar {
		position: absolute;
		min-height: 40px;
		bottom: 0;
		left: 1rem;
		z-index: 1000;

		display: flex;
		align-items: stretch;

		background: rgba(255, 255, 255, 0.97);
		border-radius: 12px 12px 0 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;

		user-select: none;
	}

	/* ---------- Tool segment ---------- */

	.tools {
		display: flex;
		align-items: stretch;
	}

	.tools button {
		all: unset;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0 0.9rem;
		height: 100%;

		font-size: 0.85rem;
		font-weight: 500;
		color: #333;

		cursor: pointer;
	}

	.tools button:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.tools button.active {
		background: #222;
		color: white;
	}

	/* Round only outer edges */
	.tools button:first-child {
		border-top-left-radius: 10px;
	}

	/* Optional visual separators */
	.tools button + button {
		border-left: 1px solid rgba(0, 0, 0, 0.08);
	}

	/* ---------- Fade segment ---------- */

	.fade {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.9rem;

		border-left: 1px solid rgba(0, 0, 0, 0.08);
	}

	.fade .doc {
		width: 1.4rem;
		height: 1.4rem;

		display: grid;
		place-items: center;

		font-size: 0.75rem;
		font-weight: 700;

		color: #333;
		background: rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(0, 0, 0, 0.15);

		border-radius: 4px;
	}

	.fade input[type='range'] {
		-webkit-appearance: none;
		appearance: none;

		width: 90px;
		height: 4px;

		background: #bbb;
		border-radius: 2px;
		outline: none;
	}

	.fade input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #222;
		cursor: pointer;
	}

	.fade input[type='range']::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #222;
		border: none;
		cursor: pointer;
	}

	/* ---------- Focus ---------- */

	button:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: -2px;
	}
</style>
