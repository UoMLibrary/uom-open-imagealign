<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getDerivedUrl, type DerivationKind } from '$lib/image/derivationService';

	interface Props {
		contentHash: string;
		kind: DerivationKind; // 'thumb' | 'work'
		alt?: string;
		class?: string;
		onMissing?: ((contentHash: string) => void) | undefined;
	}

	let { contentHash, kind, alt = 'Image', class: className = '', onMissing }: Props = $props();

	// $effect(() => {
	// 	console.log('DerivedImage props changed:', { contentHash, kind, alt, className });
	// });

	let src: string | null = null;
	let state: 'loading' | 'ready' | 'missing' = 'loading';

	let release: (() => void) | null = null;
	let runId = 0;

	function cleanup() {
		release?.();
		release = null;
	}

	async function load() {
		const id = ++runId;

		cleanup();
		src = null;
		state = 'loading';

		if (!contentHash) {
			state = 'missing';
			onMissing?.(contentHash);
			return;
		}

		try {
			const res = await getDerivedUrl(contentHash, kind);

			if (id !== runId) {
				res.release();
				return;
			}

			src = res.url;
			release = res.release;
			state = 'ready';
		} catch {
			if (id !== runId) return;
			state = 'missing';
			onMissing?.(contentHash);
		}
	}

	$effect(() => {
		contentHash;
		kind;
		void load();
	});

	onDestroy(() => cleanup());
</script>

{#if state === 'ready' && src}
	<img
		{src}
		{alt}
		class={`derived-img ${className}`}
		draggable="false"
		loading="lazy"
		decoding="async"
	/>
{:else if state === 'loading'}
	<div class="ph ph-loading">
		<div class="spinner"></div>
	</div>
{:else}
	<div class="ph ph-missing">
		<div class="icon">
			<svg viewBox="0 0 24 24" fill="none">
				<path
					d="M21 16V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M7 14l2-2 3 3 3-4 2 3"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path d="M16.5 16.5l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
		</div>
		<div class="txt">Not cached</div>
	</div>
{/if}

<style>
	.derived-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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
		font-size: 0.7rem;
	}
</style>
