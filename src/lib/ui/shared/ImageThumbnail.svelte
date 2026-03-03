<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get } from 'idb-keyval';
	import { NORMALISE_VERSION, THUMB_VERSION, TRIM_VERSION } from '$lib/image/versions';

	interface Props {
		contentHash: string;
		fallbackSrc: string;
		label?: string;
		mode?: 'thumb' | 'normalised' | 'trim';
		debugCompare?: boolean;
	}

	// ✅ Svelte 5: use `let` so props stay reactive
	let { contentHash, fallbackSrc, label, mode = 'thumb', debugCompare = false }: Props = $props();

	const versionMap = {
		thumb: THUMB_VERSION,
		normalised: NORMALISE_VERSION,
		trim: TRIM_VERSION
	} as const;

	const prefixMap = {
		thumb: 'thumb',
		normalised: 'norm', // ensure this matches your writer keys
		trim: 'trim'
	} as const;

	let src: string | null = null; // start null so we don't fetch fallback immediately
	let trimSrc: string | null = null;

	let broken = false;
	let loading = true;

	let objectUrl: string | null = null;
	let trimObjectUrl: string | null = null;

	let runId = 0;

	function cleanupUrls() {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		if (trimObjectUrl) URL.revokeObjectURL(trimObjectUrl);
		objectUrl = null;
		trimObjectUrl = null;
	}

	async function loadImage() {
		const id = ++runId;

		loading = true;
		broken = false;
		cleanupUrls();

		// don't set fallback yet — wait until we know we need it
		src = null;
		trimSrc = null;

		if (!contentHash) {
			src = fallbackSrc;
			loading = false;
			return;
		}

		try {
			const key = `${prefixMap[mode]}::${contentHash}::${versionMap[mode]}`;
			const blob = await get<unknown>(key);

			if (id !== runId) return;

			if (blob instanceof Blob) {
				objectUrl = URL.createObjectURL(blob);
				src = objectUrl;
			} else {
				src = fallbackSrc;
			}

			if (debugCompare) {
				const trimKey = `trim::${contentHash}::${TRIM_VERSION}`;
				const trimBlob = await get<unknown>(trimKey);

				if (id !== runId) return;

				if (trimBlob instanceof Blob) {
					trimObjectUrl = URL.createObjectURL(trimBlob);
					trimSrc = trimObjectUrl;
				}
			}
		} catch {
			if (id !== runId) return;
			src = fallbackSrc;
		} finally {
			if (id === runId) loading = false;
		}
	}

	// ✅ Make dependencies explicit so the effect re-runs when props change
	$effect(() => {
		contentHash;
		fallbackSrc;
		mode;
		debugCompare;
		void loadImage();
	});

	onDestroy(() => {
		cleanupUrls();
	});
</script>

<div class="thumb">
	<div class="image-frame {debugCompare ? 'debug' : ''}">
		{#if broken}
			<div class="placeholder">
				<div class="placeholder-icon">🖼️</div>
				<div class="placeholder-text">Re-import folder<br />to relink</div>
			</div>
		{:else if loading || !src}
			<div class="placeholder">
				<div class="placeholder-text">Loading…</div>
			</div>
		{:else if debugCompare && trimSrc}
			<div class="compare">
				<img src={fallbackSrc} alt="original" draggable="false" loading="lazy" decoding="async" />
				<img src={trimSrc} alt="trimmed" draggable="false" loading="lazy" decoding="async" />
			</div>
		{:else}
			<img
				{src}
				alt={label ?? 'Image'}
				draggable="false"
				loading="lazy"
				decoding="async"
				on:error={() => (broken = true)}
				on:load={() => (broken = false)}
			/>
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
		width: 100%;
	}

	.image-frame {
		width: 100%;
		aspect-ratio: 1 / 1;
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
