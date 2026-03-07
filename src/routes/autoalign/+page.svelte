<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ResultPanel from '$lib/workspace/AlignMode/tools/Manual/ResultPanel.svelte';
	import { warpImageWithTransform } from '$lib/imagealign/vggWarpService';

	import {
		initVggAlign,
		getTransformForImages,
		getImageFromTransform,
		type TransformData,
		type TransformType
	} from '$lib/imagealign/vggAlignService';

	type ImageInfo = {
		width: number;
		height: number;
		size: number;
		type: string;
		name: string;
	};

	let baseFile = $state<File | null>(null);
	let queryFile = $state<File | null>(null);

	let baseUrl = $state<string | null>(null);
	let queryUrl = $state<string | null>(null);

	let warpedUrl = $state<string | null>(null);
	let warpedRefreshKey = $state(0);

	let baseInfo = $state<ImageInfo | null>(null);
	let queryInfo = $state<ImageInfo | null>(null);

	let transformType = $state<TransformType>('affine');
	let photometric = $state(false);

	let isRunning = $state(false);
	let error = $state<string | null>(null);
	let transformData = $state<TransformData | null>(null);

	let engineReady = $state(false);
	let engineStatus = $state('Loading VGG alignment engine...');

	let baseInputEl = $state<HTMLInputElement | null>(null);
	let queryInputEl = $state<HTMLInputElement | null>(null);

	let resultMode = $state<'warped' | 'composite' | 'difference'>('warped');
	let overlayOpacityPct = $state(60);

	let resultFocus = $state<{ x: number; y: number } | null>(null);

	let drawer = $state<'auto' | 'canvas' | 'webgl' | 'html' | Array<string>>('canvas');

	const canAlign = $derived(
		Boolean(baseFile && queryFile && baseInfo && queryInfo && engineReady && !isRunning)
	);

	onMount(() => {
		void initVggAlign()
			.then(() => {
				engineReady = true;
				engineStatus = 'VGG alignment engine ready';
			})
			.catch((err) => {
				error = err instanceof Error ? err.message : 'Failed to load engine';
				engineStatus = 'Failed to load VGG alignment engine';
			});
	});

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	async function readImageInfo(file: File): Promise<ImageInfo> {
		const bitmap = await createImageBitmap(file);

		try {
			return {
				width: bitmap.width,
				height: bitmap.height,
				size: file.size,
				type: file.type || 'unknown',
				name: file.name
			};
		} finally {
			bitmap.close();
		}
	}

	async function setSelectedFile(kind: 'base' | 'query', file: File | null) {
		error = null;
		transformData = null;

		if (kind === 'base') {
			if (baseUrl) URL.revokeObjectURL(baseUrl);
			baseFile = null;
			baseUrl = null;
			baseInfo = null;
		} else {
			if (queryUrl) URL.revokeObjectURL(queryUrl);
			queryFile = null;
			queryUrl = null;
			queryInfo = null;
		}

		if (!file) return;

		const url = URL.createObjectURL(file);
		const info = await readImageInfo(file);

		if (kind === 'base') {
			baseFile = file;
			baseUrl = url;
			baseInfo = info;
		} else {
			queryFile = file;
			queryUrl = url;
			queryInfo = info;
		}
	}

	async function onBaseChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		await setSelectedFile('base', file);
	}

	async function onQueryChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		await setSelectedFile('query', file);
	}

	function clearBase() {
		if (baseInputEl) baseInputEl.value = '';
		void setSelectedFile('base', null);
	}

	function clearQuery() {
		if (queryInputEl) queryInputEl.value = '';
		void setSelectedFile('query', null);
	}

	async function runAlignment() {
		if (!baseFile || !queryFile || !engineReady) return;

		isRunning = true;
		error = null;
		transformData = null;

		try {
			const transform = await getTransformForImages(baseFile, queryFile, {
				type: transformType,
				photometric
			});

			transformData = transform;

			const warpedBlob = await warpImageWithTransform(queryFile, transform);

			if (warpedUrl) URL.revokeObjectURL(warpedUrl);

			warpedUrl = URL.createObjectURL(warpedBlob);
			warpedRefreshKey++;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Alignment failed';
		} finally {
			isRunning = false;
		}
	}

	onDestroy(() => {
		if (baseUrl) URL.revokeObjectURL(baseUrl);
		if (queryUrl) URL.revokeObjectURL(queryUrl);
		if (warpedUrl) URL.revokeObjectURL(warpedUrl);
	});
</script>

<svelte:head>
	<title>VGG Align Test</title>
</svelte:head>

<div class="page">
	<h1>VGG Align Test</h1>

	<div class="grid">
		<section class="panel">
			<h2>Base image</h2>

			<input bind:this={baseInputEl} type="file" accept="image/*" on:change={onBaseChange} />

			<button class="secondary" on:click={clearBase} disabled={!baseFile}> Clear </button>

			{#if baseInfo}
				<div class="meta">
					<div>{baseInfo.name}</div>
					<div>{baseInfo.width} × {baseInfo.height}</div>
					<div>{formatBytes(baseInfo.size)}</div>
				</div>
			{/if}

			{#if baseUrl}
				<img src={baseUrl} class="preview" />
			{/if}
		</section>

		<section class="panel">
			<h2>Moving image</h2>

			<input bind:this={queryInputEl} type="file" accept="image/*" on:change={onQueryChange} />

			<button class="secondary" on:click={clearQuery} disabled={!queryFile}> Clear </button>

			{#if queryInfo}
				<div class="meta">
					<div>{queryInfo.name}</div>
					<div>{queryInfo.width} × {queryInfo.height}</div>
					<div>{formatBytes(queryInfo.size)}</div>
				</div>
			{/if}

			{#if queryUrl}
				<img src={queryUrl} class="preview" />
			{/if}
		</section>
	</div>

	<section class="panel">
		<h2>Transform</h2>

		<select bind:value={transformType}>
			<option value="similarity">similarity</option>
			<option value="affine">affine</option>
			<option value="perspective">perspective</option>
			<option value="tps">tps</option>
		</select>

		<label class="checkbox">
			<input type="checkbox" bind:checked={photometric} />
			Photometric match
		</label>

		<p class="engine-status">{engineStatus}</p>

		<button class="primary" on:click={runAlignment} disabled={!canAlign}>
			{isRunning ? 'Running alignment…' : 'Generate transform'}
		</button>

		{#if error}
			<p class="error">{error}</p>
		{/if}
	</section>

	{#if warpedUrl}
		<section class="panel">
			<header class="result-head">
				<div>Result</div>

				<div class="result-controls">
					{#if resultMode !== 'warped'}
						<label>
							Opacity
							<input type="range" min="0" max="100" bind:value={overlayOpacityPct} />
						</label>
					{/if}

					<select bind:value={resultMode}>
						<option value="warped">Warped</option>
						<option value="composite">Composite</option>
						<option value="difference">Difference</option>
					</select>
				</div>
			</header>

			<div class="viewer">
				<ResultPanel
					imageUrl={resultMode === 'warped' ? warpedUrl : baseUrl}
					overlayUrl={resultMode === 'warped' ? null : warpedUrl}
					overlayOpacity={overlayOpacityPct / 100}
					overlayCompositeOperation={resultMode === 'difference' ? 'difference' : null}
					refreshKey={warpedRefreshKey}
					mode={resultMode}
					focus={resultFocus}
					{drawer}
				/>
			</div>
		</section>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		overflow-y: auto;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: #f6f7f9;
		color: #1f2937;
	}

	.page {
		max-width: 1200px;
		margin: auto;
		padding: 2rem;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.preview {
		max-width: 100%;
		margin-top: 1rem;
		border-radius: 8px;
	}

	.viewer {
		height: 600px;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.65);
	}

	.result-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.result-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	button {
		margin-top: 0.5rem;
		padding: 0.6rem 0.9rem;
		border-radius: 8px;
		border: 1px solid #ccc;
	}

	.primary {
		background: #111827;
		color: white;
		border-color: #111827;
	}

	.error {
		color: #b91c1c;
	}

	input[type='file'] {
		padding: 0.5rem;
		border-radius: 8px;
		border: 1px solid #d1d5db;
		background: white;
	}
</style>
