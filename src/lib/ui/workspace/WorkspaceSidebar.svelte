<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { appConfigState } from '$lib/config/appConfigStore.svelte';

	type Props = {
		side?: 'left' | 'right';
		open?: boolean;
		width?: number;
		children?: Snippet;
		header?: Snippet;
	};

	// Which side the panel is attached to. Controls toggle key + button placement.
	let { side = 'left', open = $bindable(true), width = 260, children, header }: Props = $props();

	// Toggle panel state. Parent reacts via bind:open.
	function toggle() {
		open = !open;
	}

	// Keyboard shortcut handler. [  toggles left panel, ]  toggles right panel
	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		const leftKey = appConfigState.leftPanelToggleKey;
		const rightKey = appConfigState.rightPanelToggleKey;

		// Do not interfere with typing
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
			return;
		}

		if ((side === 'left' && e.key === leftKey) || (side === 'right' && e.key === rightKey)) {
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
			{@render header?.()}
		</header>

		{#if open}
			<div class="panel-content">
				{@render children?.()}
			</div>
		{/if}
	</aside>

	<button class="toggle" onclick={toggle} aria-label="Toggle {side} panel">
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
		display: flex;
		height: 100%;
		min-height: 0;
		min-width: 0;
		flex: 0 0 auto;
	}

	/* =========================================================
	   Panel structure
	========================================================= */

	aside {
		width: var(--panel-width);
		height: 100%;
		min-height: 0;
		min-width: 0;
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
		flex: 1 1 auto;
		min-height: 0;
		min-width: 0;
		height: 100%;
		overflow: hidden;
	}

	/* =========================================================
	   Toggle button
	========================================================= */

	.toggle {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 10;

		background: rgba(255, 255, 255, 0.96);
		border: 1px solid rgba(15, 23, 42, 0.12);
		padding: 0.35rem 0.45rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.82;
		box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
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
