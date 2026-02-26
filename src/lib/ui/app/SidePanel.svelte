<script>
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	export let side = 'left'; // 'left' | 'right'
	export let open = true;
	export let width = 260;

	const dispatch = createEventDispatcher();

	function toggle() {
		open = !open;
		dispatch('toggle', open);
	}

	function onKeyDown(e) {
		// Don't interfere with typing
		if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
			return;
		}

		// Left panel toggle
		if (side === 'left' && e.key === '[') {
			e.preventDefault();
			toggle();
		}

		// Right panel toggle
		if (side === 'right' && e.key === ']') {
			e.preventDefault();
			toggle();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', onKeyDown);
	});
</script>

<div class="side-panel {side}" class:collapsed={!open} style="--panel-width: {width}px">
	<aside>
		<header>
			<slot name="header" />
		</header>

		{#if open}
			<div class="panel-content">
				<slot />
			</div>
		{/if}
	</aside>

	<button class="toggle" on:click={toggle} aria-label="Toggle panel">
		{#if side === 'left'}
			{open ? '⟨' : '⟩'}
		{:else}
			{open ? '⟩' : '⟨'}
		{/if}
	</button>
</div>

<style>
	.side-panel {
		position: relative;
		height: 100%;
	}

	aside {
		width: var(--panel-width);
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #f9f9f9;
		overflow: hidden;
		transition: width 0.2s ease;
	}

	.side-panel,
	.viewer {
		min-height: 0; /* allows scrolling instead of growth */
	}

	.collapsed aside {
		width: 0;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;

		/* Prevent layout jump */
		scrollbar-gutter: stable;

		/* Firefox */
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
	}

	/* WebKit (Chrome, Edge, Safari) */
	.panel-content::-webkit-scrollbar {
		width: 8px;
	}

	.panel-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.panel-content::-webkit-scrollbar-thumb {
		background-color: rgba(0, 0, 0, 0.25);
		border-radius: 6px;
	}

	.panel-content::-webkit-scrollbar-thumb:hover {
		background-color: rgba(0, 0, 0, 0.35);
	}

	.toggle {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 10;

		background: #eee;
		border: 1px solid #ccc;
		padding: 0.4rem 0.5rem;
		cursor: pointer;
		opacity: 0.6;
	}

	.toggle:hover {
		opacity: 1;
	}

	.left .toggle {
		left: 100%;
		border-left: none;
		border-radius: 0 4px 4px 0;
	}

	.right .toggle {
		right: 100%;
		border-right: none;
		border-radius: 4px 0 0 4px;
	}
</style>
