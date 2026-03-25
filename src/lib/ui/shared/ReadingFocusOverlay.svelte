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

	const bandStyle = $derived(
		[
			`background:${color}`,
			`opacity:${enabled ? opacity : 0}`,
			`backdrop-filter:${blurPx > 0 ? `blur(${blurPx}px)` : 'none'}`,
			`-webkit-backdrop-filter:${blurPx > 0 ? `blur(${blurPx}px)` : 'none'}`,
			`transition:
				height ${durationMs}ms ease,
				opacity ${durationMs}ms ease,
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
	<div class="band top" style={`height:${sidePct}%; ${bandStyle}`}></div>
	<div class="clear" style={clearStyle}></div>
	<div class="band bottom" style={`height:${sidePct}%; ${bandStyle}`}></div>
</div>

<style>
	.focus-overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		pointer-events: none;
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
		will-change: height, opacity;
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
