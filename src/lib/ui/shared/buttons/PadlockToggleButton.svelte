<script>
	import { createEventDispatcher } from 'svelte';

	export let locked = true;

	const dispatch = createEventDispatcher();

	function toggle() {
		locked = !locked;
		dispatch('change', { locked });
	}
</script>

<button
	class="padlock"
	class:locked
	on:click={toggle}
	aria-pressed={locked}
	aria-label={locked ? 'Unlock view' : 'Lock view'}
>
	<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
		<!-- Shackle -->
		<path
			class="shackle"
			d={locked ? 'M7 10V7a5 5 0 0110 0v3' : 'M7 10V7a5 5 0 019-2'}
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>

		<!-- Body -->
		<rect
			x="5"
			y="10"
			width="14"
			height="10"
			rx="2"
			stroke="currentColor"
			stroke-width="2"
			fill="none"
		/>
	</svg>
</button>

<style>
	.padlock {
		all: unset;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0 0.9rem;
		height: 100%;

		cursor: pointer;
		color: #555;

		border-left: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 0 10px 0 0;
	}

	.padlock:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.padlock.locked {
		background: #222;
		color: white;
	}

	.padlock:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: -2px;
	}
</style>
