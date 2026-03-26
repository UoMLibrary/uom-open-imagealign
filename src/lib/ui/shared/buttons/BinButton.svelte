<script lang="ts">
	type Props = {
		title?: string;
		size?: number;
		onClick?: () => void;
	};

	let { title = 'Delete', size = 14, onClick }: Props = $props();

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		onClick?.();
	}
</script>

<button class="bin" onclick={handleClick} aria-label={title} {title}>
	<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
		<!-- Lid -->
		<path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />

		<!-- Handle -->
		<path
			d="M8 6v-1a1 1 0 011-1h6a1 1 0 011 1v1"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>

		<!-- Body -->
		<rect
			x="6"
			y="6"
			width="12"
			height="14"
			rx="2"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		/>

		<!-- Rails -->
		<path
			d="M10 11v6M14 11v6"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
	</svg>
</button>

<style>
	.bin {
		all: unset;

		display: flex;
		align-items: center;
		justify-content: center;

		width: 24px;
		height: 24px;

		color: #666;
		cursor: pointer;
	}

	.bin:hover {
		color: #111;
	}

	.bin:active {
		color: #000;
	}

	.bin:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}
</style>
