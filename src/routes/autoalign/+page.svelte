<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		initVggAlign,
		getTransformForImages,
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
				error = err instanceof Error ? err.message : 'Failed to load VGG alignment engine';
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
			transformData = await getTransformForImages(baseFile, queryFile, {
				type: transformType,
				photometric
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate transform data';
		} finally {
			isRunning = false;
		}
	}

	onDestroy(() => {
		if (baseUrl) URL.revokeObjectURL(baseUrl);
		if (queryUrl) URL.revokeObjectURL(queryUrl);
	});
</script>

<svelte:head>
	<title>VGG Align Test</title>
</svelte:head>

<div class="page">
	<h1>VGG Align Test</h1>
	<p class="intro">
		Load a base image and a moving image, then generate placeholder transform data.
	</p>

	<div class="grid">
		<section class="panel">
			<h2>Base image (fixed / target)</h2>

			<input bind:this={baseInputEl} type="file" accept="image/*" on:change={onBaseChange} />

			<div class="actions">
				<button type="button" class="secondary" on:click={clearBase} disabled={!baseFile}>
					Clear
				</button>
			</div>

			{#if baseInfo}
				<div class="meta">
					<div><strong>Name:</strong> {baseInfo.name}</div>
					<div><strong>Type:</strong> {baseInfo.type}</div>
					<div><strong>Size:</strong> {formatBytes(baseInfo.size)}</div>
					<div><strong>Dimensions:</strong> {baseInfo.width} × {baseInfo.height}</div>
				</div>
			{/if}

			{#if baseUrl}
				<div class="preview-wrap">
					<img src={baseUrl} alt="Base preview" class="preview" />
				</div>
			{/if}
		</section>

		<section class="panel">
			<h2>Moving image (query)</h2>

			<input bind:this={queryInputEl} type="file" accept="image/*" on:change={onQueryChange} />

			<div class="actions">
				<button type="button" class="secondary" on:click={clearQuery} disabled={!queryFile}>
					Clear
				</button>
			</div>

			{#if queryInfo}
				<div class="meta">
					<div><strong>Name:</strong> {queryInfo.name}</div>
					<div><strong>Type:</strong> {queryInfo.type}</div>
					<div><strong>Size:</strong> {formatBytes(queryInfo.size)}</div>
					<div><strong>Dimensions:</strong> {queryInfo.width} × {queryInfo.height}</div>
				</div>
			{/if}

			{#if queryUrl}
				<div class="preview-wrap">
					<img src={queryUrl} alt="Moving preview" class="preview" />
				</div>
			{/if}
		</section>
	</div>

	<section class="panel controls">
		<h2>Transform settings</h2>

		<div class="control-row">
			<label for="transformType">Type</label>
			<select id="transformType" bind:value={transformType}>
				<option value="similarity">similarity</option>
				<option value="affine">affine</option>
				<option value="perspective">perspective</option>
				<option value="tps">tps</option>
			</select>
		</div>

		<label class="checkbox">
			<input type="checkbox" bind:checked={photometric} />
			<span>Photometric / brightness matching</span>
		</label>

		<p class="engine-status">{engineStatus}</p>

		<button type="button" class="primary" on:click={runAlignment} disabled={!canAlign}>
			{#if isRunning}
				Generating transform...
			{:else}
				Generate transform data
			{/if}
		</button>

		{#if error}
			<p class="error">{error}</p>
		{/if}
	</section>

	{#if transformData}
		<section class="panel">
			<h2>Returned transformation data</h2>
			<pre>{JSON.stringify(transformData, null, 2)}</pre>
		</section>
	{/if}
</div>

<style>
	.engine-status {
		margin: 0;
		color: #4b5563;
		font-size: 0.95rem;
	}

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
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		line-height: 1.1;
	}

	h2 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}

	.intro {
		margin: 0 0 1.5rem 0;
		color: #4b5563;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		padding: 1rem;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.04);
	}

	.controls {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.control-row {
		display: grid;
		gap: 0.5rem;
		max-width: 320px;
	}

	label {
		font-weight: 600;
	}

	input[type='file'],
	select,
	button {
		font: inherit;
	}

	input[type='file'],
	select {
		padding: 0.65rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 10px;
		background: white;
	}

	.actions {
		margin-top: 0.75rem;
	}

	button {
		padding: 0.75rem 1rem;
		border-radius: 10px;
		border: 1px solid #d1d5db;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.primary {
		background: #111827;
		color: white;
		border-color: #111827;
		width: fit-content;
	}

	.secondary {
		background: white;
		color: #111827;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 500;
	}

	.meta {
		margin-top: 1rem;
		display: grid;
		gap: 0.35rem;
		font-size: 0.95rem;
		color: #374151;
	}

	.preview-wrap {
		margin-top: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		background: #f9fafb;
	}

	.preview {
		display: block;
		max-width: 100%;
		max-height: 360px;
		margin: 0 auto;
		object-fit: contain;
	}

	pre {
		margin: 0;
		padding: 1rem;
		border-radius: 12px;
		background: #0f172a;
		color: #e5e7eb;
		overflow: auto;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.error {
		margin: 0;
		color: #b91c1c;
		font-weight: 600;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}

		.page {
			padding: 1rem;
		}
	}
</style>
