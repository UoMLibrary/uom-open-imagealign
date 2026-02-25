<script lang="ts">
	// lib/ui/features/thmbnails/ImageThumbnail.svelte
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'idb-keyval';
	import { NORMALISE_VERSION, THUMB_VERSION, TRIM_VERSION } from '$lib/image/versions';

	export let contentHash: string;
	export let fallbackSrc: string;
	export let label: string | undefined = undefined;

	// Which derived version to display
	export let mode: 'thumb' | 'normalised' | 'trim' = 'thumb';

	// Debug: show original + trimmed side by side
	export let debugCompare: boolean = false;

	const versionMap = {
		thumb: THUMB_VERSION,
		normalised: NORMALISE_VERSION,
		trim: TRIM_VERSION
	};

	const prefixMap = {
		thumb: 'thumb',
		normalised: 'norm',
		trim: 'trim'
	};

	let src: string = fallbackSrc;
	let trimSrc: string | null = null;

	let broken = false;
	let objectUrl: string | null = null;
	let trimObjectUrl: string | null = null;

	async function loadImage() {
		if (!contentHash) return;

		// Cleanup old URLs
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}
		if (trimObjectUrl) {
			URL.revokeObjectURL(trimObjectUrl);
			trimObjectUrl = null;
		}

		// Main image
		const key = `${prefixMap[mode]}::${contentHash}::${versionMap[mode]}`;
		const blob = await get(key);

		if (blob) {
			objectUrl = URL.createObjectURL(blob);
			src = objectUrl;
		} else {
			src = fallbackSrc;
		}

		// Debug trimmed version
		if (debugCompare) {
			const trimKey = `trim::${contentHash}::${TRIM_VERSION}`;
			const trimBlob = await get(trimKey);

			if (trimBlob) {
				trimObjectUrl = URL.createObjectURL(trimBlob);
				trimSrc = trimObjectUrl;
			} else {
				trimSrc = null;
			}
		} else {
			trimSrc = null;
		}
	}

	onMount(loadImage);

	// React to changes
	$: (contentHash, mode, debugCompare, loadImage());

	onDestroy(() => {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		if (trimObjectUrl) URL.revokeObjectURL(trimObjectUrl);
	});
</script>

<div class="thumb">
	<div class="image-frame {debugCompare ? 'debug' : ''}">
		{#if !broken}
			{#if debugCompare && trimSrc}
				<div class="compare">
					<img src={fallbackSrc} alt="original" draggable="false" />
					<img src={trimSrc} alt="trimmed" draggable="false" />
				</div>
			{:else}
				<img
					{src}
					alt={label ?? 'Image'}
					draggable="false"
					on:error={() => (broken = true)}
					on:load={() => (broken = false)}
				/>
			{/if}
		{:else}
			<div class="placeholder">
				<div class="placeholder-icon">🖼️</div>
				<div class="placeholder-text">
					Re-import folder<br />to relink
				</div>
			</div>
		{/if}
	</div>

	{#if label}
		<div class="label">{label}</div>
	{/if}
</div>

<style>
	.thumb {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 120px;
	}

	.image-frame {
		width: 100%;
		height: 120px;
		border-radius: 6px;
		background: white;
		border: 1px solid #ddd;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 0.25rem;
		box-sizing: border-box;
	}

	img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		user-select: none;
		pointer-events: none;
	}

	/*  Debug mode */
	.image-frame.debug {
		padding: 0;
	}

	.compare {
		display: flex;
		width: 100%;
		height: 100%;
	}

	.compare img {
		width: 50%;
		height: 100%;
		object-fit: contain;
		border-right: 1px solid #eee;
	}

	.compare img:last-child {
		border-right: none;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 0.65rem;
		color: #666;
		padding: 0.5rem;
		width: 100%;
		height: 100%;
	}

	.placeholder-icon {
		font-size: 1.25rem;
		margin-bottom: 0.25rem;
		opacity: 0.6;
	}

	.placeholder-text {
		line-height: 1.2;
	}

	.label {
		font-size: 0.7rem;
		color: #444;
		word-break: break-word;
	}
</style>
