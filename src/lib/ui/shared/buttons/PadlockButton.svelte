<script lang="ts">
	type Props = {
		locked?: boolean;
		color?: string;
		size?: number;
		showHover?: boolean;
		onChange?: (locked: boolean) => void;
		ariaLabelLocked?: string;
		ariaLabelUnlocked?: string;
	};

	let {
		locked = true,
		color = '#374151',
		size = 18,
		showHover = false,
		onChange,
		ariaLabelLocked = 'Unlock',
		ariaLabelUnlocked = 'Lock'
	}: Props = $props();

	function toggle() {
		locked = !locked;
		onChange?.(locked);
	}
</script>

<button
	type="button"
	class="padlock"
	class:no-hover={!showHover}
	aria-pressed={locked}
	aria-label={locked ? ariaLabelLocked : ariaLabelUnlocked}
	onclick={toggle}
	style="--icon-color: {color}; --icon-size: {size}px"
>
	<svg
		viewBox="0 0 24 24"
		width="var(--icon-size)"
		height="var(--icon-size)"
		fill="none"
		stroke="var(--icon-color)"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect x="4" y="11" width="16" height="9" rx="2" />

		{#if locked}
			<path d="M8 11V7a4 4 0 0 1 8 0v4" />
		{:else}
			<path d="M8 11V7a4 4 0 0 1 7 -2" />
		{/if}
	</svg>
</button>

<style>
	.padlock {
		background: transparent;
		border: none;
		padding: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 6px;
		transition:
			background 0.15s ease,
			transform 0.05s ease;
	}

	/* Hover highlight */
	.padlock:not(.no-hover):hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.padlock:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	.padlock:active {
		transform: scale(0.95);
	}
</style>
