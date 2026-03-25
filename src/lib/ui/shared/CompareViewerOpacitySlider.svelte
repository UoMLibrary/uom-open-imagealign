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

	let track: HTMLDivElement | null = null;

	const percent = $derived(((value - min) / Math.max(max - min, 0.00001)) * 100);

	function clamp(n: number) {
		return Math.max(min, Math.min(max, n));
	}

	function snap(n: number) {
		const steps = Math.round((n - min) / step);
		return clamp(min + steps * step);
	}

	function setFromPointerEvent(e: PointerEvent) {
		if (!track || disabled) return;

		const rect = track.getBoundingClientRect();

		let ratio = 0;

		if (orientation === 'vertical') {
			const y = e.clientY - rect.top;
			ratio = y / rect.height;
		} else {
			const x = e.clientX - rect.left;
			ratio = x / rect.width;
		}

		ratio = Math.max(0, Math.min(1, ratio));

		const next = snap(min + ratio * (max - min));
		value = next;
		onChange?.(next);
	}

	function onPointerDown(e: PointerEvent) {
		if (!track || disabled) return;

		track.setPointerCapture(e.pointerId);
		setFromPointerEvent(e);

		const move = (ev: PointerEvent) => setFromPointerEvent(ev);

		const stop = (ev: PointerEvent) => {
			track?.releasePointerCapture(ev.pointerId);
			track?.removeEventListener('pointermove', move);
			track?.removeEventListener('pointerup', stop);
			track?.removeEventListener('pointercancel', stop);
		};

		track.addEventListener('pointermove', move);
		track.addEventListener('pointerup', stop);
		track.addEventListener('pointercancel', stop);
	}
</script>

<div class="slider" class:vertical={orientation === 'vertical'} class:disabled>
	<span class="sr-only">{label}</span>

	<div
		class="track"
		bind:this={track}
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		onpointerdown={onPointerDown}
	>
		<div
			class="fill"
			style={orientation === 'vertical' ? `top:0;height:${percent}%;` : `width:${percent}%;`}
		></div>

		<div
			class="thumb"
			style={orientation === 'vertical' ? `top:${percent}%;` : `left:${percent}%;`}
		></div>
	</div>
</div>

<style>
	.slider {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.slider.disabled {
		opacity: 0.45;
	}

	.track {
		position: relative;
		background: rgba(15, 23, 42, 0.12);
		border-radius: 999px;
		cursor: pointer;
	}

	.slider:not(.vertical) .track {
		width: 72px;
		height: 4px;
	}

	.slider.vertical .track {
		width: 4px;
		height: 52px;
	}

	.fill {
		position: absolute;
		left: 0;
		background: rgba(15, 23, 42, 0.28);
		border-radius: 999px;
	}

	.slider:not(.vertical) .fill {
		top: 0;
		bottom: 0;
	}

	.slider.vertical .fill {
		width: 100%;
	}

	.thumb {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		border: 1px solid rgba(15, 23, 42, 0.12);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.16);
	}

	.slider:not(.vertical) .thumb {
		top: 50%;
		transform: translate(-50%, -50%);
	}

	.slider.vertical .thumb {
		left: 50%;
		transform: translate(-50%, -50%);
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
