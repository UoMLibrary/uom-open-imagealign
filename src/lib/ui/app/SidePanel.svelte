<script lang="ts">
	import { onMount } from 'svelte';

	// Which side the panel is attached to. Controls toggle key + button placement.
	export let side: 'left' | 'right' = 'left';

	// Whether the panel is open. Parent should use: bind:open
	export let open = true;

	// Width in pixels when expanded.
	export let width = 260;

	// Toggle panel state. Parent reacts via bind:open.
	function toggle() {
		open = !open;
	}

	// Keyboard shortcut handler. [  toggles left panel, ]  toggles right panel
	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;

		// Do not interfere with typing
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
			return;
		}

		if ((side === 'left' && e.key === '[') || (side === 'right' && e.key === ']')) {
			e.preventDefault();
			toggle();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="side-panel {side}" class:collapsed={!open} style="--panel-width: {width}px">
	<aside>
		<header class="panel-header">
			<slot name="header" />
		</header>

		{#if open}
			<div class="panel-content">
				<slot />
			</div>
		{/if}
	</aside>

	<button class="toggle" on:click={toggle} aria-label="Toggle {side} panel">
		{#if side === 'left'}
			{open ? '⟨' : '⟩'}
		{:else}
			{open ? '⟩' : '⟨'}
		{/if}
	</button>
</div>

<style>
	/* =========================================================
	   Layout container
	========================================================= */

	.side-panel {
		position: relative;
		height: 100%;
		min-height: 0; /* allows proper flex scrolling */
	}

	/* =========================================================
	   Panel structure
	========================================================= */

	aside {
		width: var(--panel-width);
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #f9f9f9;
		overflow: hidden;
		transition: width 0.2s ease;
	}

	.side-panel.collapsed aside {
		width: 0;
	}

	.panel-header {
		flex-shrink: 0;
	}

	/* =========================================================
	   Scrollable content
	========================================================= */

	.panel-content {
		flex: 1;
		overflow-y: auto;
		scrollbar-color: rgba(0, 0, 0, 0.25) transparent; /* Firefox */
	}

	/* =========================================================
	   Toggle button
	========================================================= */

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

	/* Side-specific placement */

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
