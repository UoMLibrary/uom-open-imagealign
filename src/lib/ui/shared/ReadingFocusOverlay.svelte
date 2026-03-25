<script lang="ts">
	type Props = {
		enabled?: boolean;
		clearCenterPct?: number;
		opacity?: number;
		blurPx?: number;
		color?: string;
		durationMs?: number;
	};

	let {
		enabled = false,
		clearCenterPct = 30,
		opacity = 0.35,
		blurPx = 0,
		color = '#000000',
		durationMs = 180
	}: Props = $props();

	const clampedCenterPct = $derived(Math.max(0, Math.min(100, clearCenterPct)));
	const animatedCenterPct = $derived(enabled ? clampedCenterPct : 100);
	const sidePct = $derived((100 - animatedCenterPct) / 2);

	function toOverlayColor(color: string, alpha: number) {
		if (color.startsWith('#')) {
			let hex = color.slice(1);

			if (hex.length === 3) {
				hex = hex
					.split('')
					.map((c) => c + c)
					.join('');
			}

			if (hex.length === 6) {
				const r = parseInt(hex.slice(0, 2), 16);
				const g = parseInt(hex.slice(2, 4), 16);
				const b = parseInt(hex.slice(4, 6), 16);
				return `rgba(${r}, ${g}, ${b}, ${alpha})`;
			}
		}

		return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
	}

	const overlayColor = $derived(toOverlayColor(color, enabled ? opacity : 0));
	const filterValue = $derived(enabled && blurPx > 0 ? `blur(${blurPx}px)` : 'none');

	const bandStyle = $derived(
		[
			`height:${sidePct}%`,
			`background:${overlayColor}`,
			`backdrop-filter:${filterValue}`,
			`-webkit-backdrop-filter:${filterValue}`,
			`transition:
				height ${durationMs}ms ease,
				background ${durationMs}ms ease,
				backdrop-filter ${durationMs}ms ease,
				-webkit-backdrop-filter ${durationMs}ms ease`
		].join('; ')
	);

	const clearStyle = $derived(
		[
			`top:${sidePct}%`,
			`height:${animatedCenterPct}%`,
			`transition: top ${durationMs}ms ease, height ${durationMs}ms ease`
		].join('; ')
	);
</script>

<div class="focus-overlay" aria-hidden="true">
	<div class="band top" style={bandStyle}></div>
	<div class="clear" style={clearStyle}></div>
	<div class="band bottom" style={bandStyle}></div>
</div>

<style>
	.focus-overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		isolation: isolate;
	}

	.focus-overlay,
	.focus-overlay * {
		pointer-events: none;
		touch-action: none;
		user-select: none;
	}

	.band {
		position: absolute;
		left: 0;
		right: 0;
		overflow: hidden;
		will-change: height, backdrop-filter, background;
		transform: translateZ(0);
	}

	.top {
		top: 0;
	}

	.bottom {
		bottom: 0;
	}

	.clear {
		position: absolute;
		left: 0;
		right: 0;
		will-change: top, height;
	}
</style>
