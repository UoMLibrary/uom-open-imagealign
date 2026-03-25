<script lang="ts">
	type Orientation = 'horizontal' | 'vertical';

	type Props = {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		orientation?: Orientation;
		disabled?: boolean;
		label?: string;
		onChange?: (value: number) => void;
	};

	let {
		value = $bindable(0.5),
		min = 0,
		max = 1,
		step = 0.01,
		orientation = 'horizontal',
		disabled = false,
		label = 'Opacity',
		onChange
	}: Props = $props();

	function clamp(n: number, min: number, max: number) {
		return Math.max(min, Math.min(max, n));
	}

	function handleInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const next = clamp(Number(target.value), min, max);
		value = next;
		onChange?.(next);
	}
</script>

<div class="slider-wrap" class:vertical={orientation === 'vertical'} class:disabled>
	<span class="sr-only">{label}</span>

	<input
		aria-label={label}
		type="range"
		{min}
		{max}
		{step}
		{disabled}
		{value}
		oninput={handleInput}
	/>
</div>

<style>
	.slider-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 0;
	}

	.slider-wrap.disabled {
		opacity: 0.45;
	}

	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 110px;
		height: 4px;
		background: rgba(15, 23, 42, 0.18);
		border-radius: 999px;
		outline: none;
		margin: 0;
	}

	.slider-wrap.vertical input[type='range'] {
		width: 110px;
		transform: rotate(-90deg);
		transform-origin: center;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid rgba(15, 23, 42, 0.14);
		background: #ffffff;
		box-shadow:
			0 1px 2px rgba(15, 23, 42, 0.18),
			0 0 0 3px rgba(255, 255, 255, 0.9);
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid rgba(15, 23, 42, 0.14);
		background: #ffffff;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
		cursor: pointer;
	}

	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.18);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
