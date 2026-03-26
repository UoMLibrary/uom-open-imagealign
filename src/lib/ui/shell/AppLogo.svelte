<script lang="ts">
	type Props = {
		compareText?: string;
		annotateText?: string;
		tag?: keyof HTMLElementTagNameMap;
		size?: string;
		align?: 'left' | 'center' | 'right';
		stackOnSmall?: boolean;
	};

	let {
		compareText = 'Compare',
		annotateText = 'Annotate',
		tag = 'h1',
		size = 'clamp(2.4rem, 6vw, 4.8rem)',
		align = 'left',
		stackOnSmall = false
	}: Props = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter+Tight:wght@600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<svelte:element
	this={tag}
	class:stack-on-small={stackOnSmall}
	class="wordmark"
	style={`--wm-size:${size}; --wm-align:${align};`}
	aria-label={`${compareText}${annotateText}`}
>
	<span class="compare">{compareText}</span><span class="annotate">{annotateText}</span>
</svelte:element>

<style>
	.wordmark {
		--wm-color: #1f1d1a;

		margin: 0;
		display: inline-block;
		font-size: var(--wm-size);
		line-height: 0.9;
		text-align: var(--wm-align);
		white-space: nowrap;
		color: var(--wm-color);

		font-kerning: normal;
		font-variant-ligatures: common-ligatures;
		text-rendering: optimizeLegibility;
	}

	.compare {
		font-family: 'Fraunces', serif;
		font-weight: 700;
		letter-spacing: -0.038em;
		opacity: 0.94;
	}

	.annotate {
		font-family: 'Inter Tight', sans-serif;
		font-weight: 700;
		letter-spacing: -0.065em;
		margin-left: 0.012em;
		position: relative;
		top: 0.01em;
	}

	@media (max-width: 640px) {
		.wordmark.stack-on-small {
			white-space: normal;
			line-height: 0.96;
		}

		.wordmark.stack-on-small .compare,
		.wordmark.stack-on-small .annotate {
			display: block;
		}

		.wordmark.stack-on-small .annotate {
			margin-left: 0;
			top: 0;
		}
	}
</style>
