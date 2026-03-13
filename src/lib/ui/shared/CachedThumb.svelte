<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getDerivedUrl } from '$lib/image/derivationService';
	import { getDerivationCacheKey } from '$lib/image/derivationState.svelte';

	interface Props {
		contentHash: string;
		alt?: string;
		onMissing?: ((contentHash: string) => void) | undefined;
	}

	let { contentHash, alt = 'Thumbnail', onMissing }: Props = $props();

	let src: string | null = $state(null);
	let state: 'loading' | 'ready' | 'missing' = $state('loading');
	let release: (() => void) | null = $state(null);

	let runId = 0;
	let lastLoadKey: string | null = null;

	function cleanup() {
		release?.();
		release = null;
	}

	async function loadFor(hash: string) {
		const id = ++runId;

		cleanup();
		src = null;
		state = 'loading';

		if (!hash) {
			state = 'missing';
			onMissing?.(hash);
			return;
		}

		try {
			const res = await getDerivedUrl(hash, 'thumb');

			if (id !== runId) {
				res.release();
				return;
			}

			release = res.release;
			src = res.url;
			state = 'ready';
		} catch (err) {
			console.error('Error loading thumbnail for', hash, err);

			if (id !== runId) return;

			state = 'missing';
			onMissing?.(hash);
		}
	}

	$effect(() => {
		const hash = contentHash;
		const loadKey = getDerivationCacheKey(hash);

		if (!hash) {
			cleanup();
			src = null;
			state = 'missing';
			lastLoadKey = null;
			return;
		}

		if (loadKey === lastLoadKey) return;

		lastLoadKey = loadKey;
		void loadFor(hash);
	});

	onDestroy(() => cleanup());
</script>

{#if state === 'ready' && src}
	<img {src} {alt} class="img" draggable="false" loading="lazy" decoding="async" />
{:else if state === 'loading'}
	<div class="ph ph-loading">
		<div class="spinner"></div>
	</div>
{:else}
	<div class="ph ph-missing">Not cached</div>
{/if}

<style>
	.img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		user-select: none;
		pointer-events: none;
	}

	.ph {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		border-radius: 10px;
	}

	.ph-loading {
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}

	.spinner {
		width: 18px;
		height: 18px;
		border-radius: 999px;
		border: 2px solid rgba(0, 0, 0, 0.15);
		border-top-color: rgba(0, 0, 0, 0.45);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.ph-missing {
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.035), rgba(0, 0, 0, 0.015));
		border: 1px dashed rgba(0, 0, 0, 0.22);
		color: rgba(0, 0, 0, 0.55);
		padding: 10px;
		box-sizing: border-box;
		text-align: center;
	}
</style>
