<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getDerivedBlob } from '$lib/image/derivationService';

	interface Props {
		contentHash: string;
		alt?: string;
		onMissing?: ((contentHash: string) => void) | undefined;
	}

	onMount(() => {
		console.log('MOUNT thumb', contentHash);
	});

	onDestroy(() => {
		console.log('DESTROY thumb', contentHash);
	});

	let { contentHash, alt = 'Thumbnail', onMissing }: Props = $props();

	let src: string | null = null;
	let state: 'loading' | 'ready' | 'missing' = 'loading';

	let runId = 0;
	let currentHash: string | null = null;

	function blobToDataUrl(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	async function loadFor(hash: string) {
		const id = ++runId;

		// reset state
		src = null;
		state = 'loading';

		try {
			const blob = await getDerivedBlob(hash, 'thumb');
			const dataUrl = await blobToDataUrl(blob);

			// stale guard
			if (id !== runId) return;

			src = dataUrl;
			state = 'ready';

			console.log(src, state);
		} catch (err) {
			console.error('Error loading thumbnail for', hash, err);
			if (id !== runId) return;

			state = 'missing';
			onMissing?.(hash);
		}
	}

	/**
	 * CRITICAL:
	 * Isolate dependency so effect only reacts to contentHash.
	 */
	$effect(() => {
		const hash = contentHash;

		if (!hash) {
			state = 'missing';
			return;
		}

		if (hash === currentHash) return;

		currentHash = hash;
		void loadFor(hash);
	});

	onDestroy(() => {
		// cancel any in-flight load
		runId++;
	});
</script>

<h3>{state}</h3>
<!-- <img src="  diff/d1.png" {alt} class="img" draggable="false" loading="lazy" decoding="async" /> -->
{#if state === 'ready' && src}
	<!-- <img {src} {alt} class="img" draggable="false" loading="lazy" decoding="async" /> -->
	<img {src} {alt} class="img" draggable="false" />
{:else if state === 'loading'}
	<div class="ph ph-loading" role="img" aria-label="Loading thumbnail">
		<div class="spinner" aria-hidden="true"></div>
	</div>
{:else}
	<div class="ph ph-missing" role="img" aria-label="Thumbnail missing from cache">
		<div class="txt">
			<div class="t1">Not cached</div>
			<div class="t2">Re-ingest folder</div>
		</div>
	</div>
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

	.t1 {
		font-size: 0.7rem;
		font-weight: 700;
	}

	.t2 {
		font-size: 0.7rem;
		opacity: 0.9;
	}
</style>
