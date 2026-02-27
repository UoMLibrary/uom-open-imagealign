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
	class="pagelock"
	class:locked
	on:click={toggle}
	aria-pressed={locked}
	aria-label={locked ? 'Unlock item' : 'Lock item'}
>
	<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
		<!-- Shackle -->
		<path
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
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		/>
	</svg>
</button>

<style>
	.pagelock {
		all: unset;

		display: flex;
		align-items: center;
		justify-content: center;

		width: 20px;
		height: 20px;

		color: #666;
		cursor: pointer;
	}

	.pagelock:hover {
		color: #111;
	}

	.pagelock.locked {
		color: #111;
	}

	.pagelock:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}
</style>
