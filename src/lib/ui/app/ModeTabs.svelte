<script lang="ts">
	import { WORKSPACE_MODES, currentMode, type WorkspaceMode } from '$lib/core/workspaceStore';

	function setMode(mode: WorkspaceMode) {
		currentMode.set(mode);
	}
</script>

<nav class="mode-tabs">
	{#each WORKSPACE_MODES as mode}
		<button class:selected={$currentMode === mode.key} on:click={() => setMode(mode.key)}>
			{mode.label}
		</button>
	{/each}
</nav>

<style>
	.mode-tabs {
		display: flex;
		align-items: flex-end;

		padding: 0.2rem 1rem 0 1rem; /* add breathing space above */
		background: rgba(255, 255, 255, 0.97);

		border-bottom: 1px solid rgba(0, 0, 0, 0.08);

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	button {
		all: unset;

		display: flex;
		align-items: center;

		padding: 0 0.9rem;
		height: 32px;

		font-size: 0.8rem; /* match header buttons */
		font-weight: 600;
		letter-spacing: 0.02em; /* match header buttons */
		text-transform: none; /* remove uppercase */

		color: #4b5563;
		cursor: pointer;

		border-radius: 6px 6px 0 0;
		position: relative;
	}

	button:hover {
		background: rgba(0, 0, 0, 0.04);
		color: #111827;
	}

	button.selected {
		color: #111827;
	}

	button.selected::after {
		content: '';
		position: absolute;
		left: 0.9rem;
		right: 0.9rem;
		bottom: 0;

		height: 2px;
		background: #111827;
		border-radius: 1px;
	}
</style>
