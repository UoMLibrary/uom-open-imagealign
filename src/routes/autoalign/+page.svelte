<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ResultPanel from '$lib/workspace/AlignMode/tools/Manual/ResultPanel.svelte';
	import TransformControls from '$lib/imagealign/TransformControls.svelte';
	import ImageDropSlot from '$lib/ui/shared/ImageDropSlot.svelte';

	import {
		ensureAlignmentEngine,
		runAlignmentWorkflow,
		type AlignmentSpec
	} from '$lib/imagealign/alignmentWorkflow';

	import type { TransformData } from '$lib/imagealign/vggAlignService';

	type ImageInfo = {
		width: number;
		height: number;
		size: number;
		type: string;
		name: string;
	};

	type SlotKind = 'base' | 'query';

	let baseFile = $state<File | null>(null);
	let queryFile = $state<File | null>(null);

	let baseUrl = $state<string | null>(null);
	let queryUrl = $state<string | null>(null);

	let warpedUrl = $state<string | null>(null);
	let warpedRefreshKey = $state(0);

	let baseInfo = $state<ImageInfo | null>(null);
	let queryInfo = $state<ImageInfo | null>(null);

	let spec = $state<AlignmentSpec>({
		type: 'affine',
		photometric: false
	});

	let isRunning = $state(false);
	let error = $state<string | null>(null);
	let transformData = $state<TransformData | null>(null);

	let engineReady = $state(false);
	let engineStatus = $state('Loading VGG alignment engine...');

	let resultMode = $state<'warped' | 'composite' | 'difference'>('composite');
	let overlayOpacity = $state(0.6);
	let resultFocus = $state<{ x: number; y: number } | null>(null);

	let drawer = $state<'auto' | 'canvas' | 'webgl' | 'html' | Array<string>>('canvas');

	const canAlign = $derived(
		Boolean(baseFile && queryFile && baseInfo && queryInfo && engineReady && !isRunning)
	);

	const loadVersion: Record<SlotKind, number> = {
		base: 0,
		query: 0
	};

	onMount(() => {
		void ensureAlignmentEngine()
			.then(() => {
				engineReady = true;
				engineStatus = 'Engine ready';
			})
			.catch((err) => {
				error = err instanceof Error ? err.message : 'Failed to load engine';
				engineStatus = 'Engine failed to load';
			});
	});

	onDestroy(() => {
		if (baseUrl) URL.revokeObjectURL(baseUrl);
		if (queryUrl) URL.revokeObjectURL(queryUrl);
		if (warpedUrl) URL.revokeObjectURL(warpedUrl);
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

	function clearWarpedResult() {
		transformData = null;

		if (warpedUrl) {
			URL.revokeObjectURL(warpedUrl);
			warpedUrl = null;
			warpedRefreshKey++;
		}
	}

	function revokeSlotUrl(kind: SlotKind) {
		if (kind === 'base') {
			if (baseUrl) URL.revokeObjectURL(baseUrl);
			baseUrl = null;
		} else {
			if (queryUrl) URL.revokeObjectURL(queryUrl);
			queryUrl = null;
		}
	}

	function resetSlot(kind: SlotKind) {
		if (kind === 'base') {
			baseFile = null;
			baseInfo = null;
		} else {
			queryFile = null;
			queryInfo = null;
		}

		revokeSlotUrl(kind);
	}

	async function setSelectedFile(kind: SlotKind, file: File | null) {
		error = null;
		clearWarpedResult();

		const version = ++loadVersion[kind];
		resetSlot(kind);

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			error = 'Please select an image file';
			return;
		}

		try {
			const info = await readImageInfo(file);

			if (version !== loadVersion[kind]) return;

			const url = URL.createObjectURL(file);

			if (kind === 'base') {
				baseFile = file;
				baseInfo = info;
				baseUrl = url;
			} else {
				queryFile = file;
				queryInfo = info;
				queryUrl = url;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not read image';
		}
	}

	function clearBase() {
		void setSelectedFile('base', null);
	}

	function clearQuery() {
		void setSelectedFile('query', null);
	}

	async function runAlignment() {
		if (!baseFile || !queryFile || !engineReady) return;

		isRunning = true;
		error = null;
		clearWarpedResult();

		try {
			const result = await runAlignmentWorkflow({
				baseFile,
				queryFile,
				spec
			});

			transformData = result.transform;
			warpedUrl = result.warpedUrl;
			warpedRefreshKey++;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Alignment failed';
		} finally {
			isRunning = false;
		}
	}

	function downloadImage(url: string | null, filename: string) {
		if (!url) return;

		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
</script>

<svelte:head>
	<title>VGG Align</title>
</svelte:head>

<div class="page-shell">
	<section class="topbar panel">
		<div class="topbar-row">
			<div class="title-wrap">
				<h1>VGG Align</h1>
				<p>Load two images, adjust the transform, then inspect the result below.</p>
			</div>

			<div
				class="status-badge"
				class:ready={engineReady}
				class:error-state={!engineReady && !!error}
			>
				{engineStatus}
			</div>
		</div>

		<div class="source-strip">
			<ImageDropSlot
				label="Base image"
				imageUrl={baseUrl}
				info={baseInfo}
				onFileSelected={(file) => setSelectedFile('base', file)}
				onClear={clearBase}
			/>

			<ImageDropSlot
				label="Moving image"
				imageUrl={queryUrl}
				info={queryInfo}
				onFileSelected={(file) => setSelectedFile('query', file)}
				onClear={clearQuery}
			/>
		</div>
	</section>

	<section class="controls-wrap panel">
		<TransformControls
			{spec}
			{engineStatus}
			{isRunning}
			{canAlign}
			{error}
			onRun={runAlignment}
			onSpecChange={(nextSpec) => (spec = nextSpec)}
		/>
	</section>

	<section class="result-panel panel">
		<header class="result-head">
			<div class="result-title-group">
				<h2>Result</h2>
				<p>
					{#if warpedUrl}
						Pan, zoom, compare, and inspect the aligned output.
					{:else if baseFile && queryFile}
						Ready to align. Adjust settings above and run the transform.
					{:else}
						Load two images above to begin.
					{/if}
				</p>
			</div>

			<div class="result-tools">
				{#if resultMode !== 'warped'}
					<label class="opacity-control">
						<span>Opacity</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							bind:value={overlayOpacity}
							disabled={!warpedUrl}
						/>
						<strong>{Math.round(overlayOpacity * 100)}%</strong>
					</label>
				{/if}

				<div class="mode-switch" aria-label="Result mode">
					<button
						type="button"
						class:selected={resultMode === 'warped'}
						on:click={() => (resultMode = 'warped')}
						disabled={!warpedUrl}
					>
						Warped
					</button>
					<button
						type="button"
						class:selected={resultMode === 'composite'}
						on:click={() => (resultMode = 'composite')}
						disabled={!warpedUrl}
					>
						Composite
					</button>
					<button
						type="button"
						class:selected={resultMode === 'difference'}
						on:click={() => (resultMode = 'difference')}
						disabled={!warpedUrl}
					>
						Difference
					</button>
				</div>

				<div class="download-actions">
					<button
						class="secondary"
						type="button"
						on:click={() => downloadImage(baseUrl, 'base-image.png')}
						disabled={!baseUrl}
					>
						Base
					</button>

					<button
						class="secondary"
						type="button"
						on:click={() => downloadImage(warpedUrl, 'warped-image.png')}
						disabled={!warpedUrl}
					>
						Warped
					</button>
				</div>
			</div>
		</header>

		<div class="viewer-shell">
			{#if warpedUrl && baseUrl}
				{#key `${baseUrl}:${warpedUrl}:${warpedRefreshKey}:${resultMode}`}
					<div class="viewer-host">
						<ResultPanel
							imageUrl={resultMode === 'warped' ? warpedUrl : baseUrl}
							overlayUrl={resultMode === 'warped' ? null : warpedUrl}
							bind:overlayOpacity
							overlayCompositeOperation={resultMode === 'difference' ? 'difference' : null}
							enableHoldDifferencePreview={resultMode !== 'warped'}
							holdDifferenceKey="Alt"
							refreshKey={warpedRefreshKey}
							mode={resultMode}
							focus={resultFocus}
							wheelAdjustOpacity={resultMode !== 'warped'}
							wheelAdjustRequiresShift={true}
							wheelSensitivityPctPerPx={0.05}
							{drawer}
						/>
					</div>
				{/key}
			{:else}
				<div class="viewer-empty">
					<div class="viewer-empty-card">
						<h3>No result yet</h3>
						<p>
							{#if baseFile && queryFile}
								Both images are loaded. Use the transform controls above to run the alignment.
							{:else}
								Drop a base image and a moving image into the squares above, or click either square
								to browse.
							{/if}
						</p>
					</div>
				</div>
			{/if}
		</div>
	</section>
</div>

<style>
	:global(html, body) {
		margin: 0;
		height: 100%;
	}

	:global(body) {
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background:
			radial-gradient(circle at top, rgba(59, 130, 246, 0.08), transparent 28%),
			linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);
		color: #0f172a;
	}

	.panel {
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.75);
		border-radius: 18px;
		box-shadow:
			0 10px 30px rgba(15, 23, 42, 0.06),
			0 1px 2px rgba(15, 23, 42, 0.05);
	}

	.topbar {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.topbar-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.title-wrap h1 {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.title-wrap p {
		margin: 0.35rem 0 0;
		color: #64748b;
		font-size: 0.95rem;
	}

	.status-badge {
		flex-shrink: 0;
		padding: 0.55rem 0.8rem;
		border-radius: 999px;
		font-size: 0.84rem;
		font-weight: 600;
		background: #e2e8f0;
		color: #334155;
	}

	.status-badge.ready {
		background: #dcfce7;
		color: #166534;
	}

	.status-badge.error-state {
		background: #fee2e2;
		color: #991b1b;
	}

	.source-strip {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.controls-wrap {
		padding: 0.9rem 1rem;
	}

	.result-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.result-title-group h2 {
		margin: 0;
		font-size: 1rem;
		letter-spacing: -0.01em;
	}

	.result-title-group p {
		margin: 0.35rem 0 0;
		color: #64748b;
		font-size: 0.9rem;
	}

	.result-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: flex-end;
	}

	.mode-switch {
		display: inline-flex;
		padding: 0.2rem;
		border-radius: 999px;
		background: #e2e8f0;
		gap: 0.2rem;
	}

	.mode-switch button {
		margin: 0;
		padding: 0.5rem 0.8rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: #334155;
		font: inherit;
		font-size: 0.86rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.mode-switch button.selected {
		background: white;
		color: #0f172a;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
	}

	.opacity-control {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		font-size: 0.84rem;
		color: #475569;
	}

	.opacity-control input[type='range'] {
		width: 120px;
	}

	.download-actions {
		display: flex;
		gap: 0.5rem;
	}

	.page-shell {
		height: 100vh;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.result-panel {
		flex: 1 1 auto;
		min-height: 0;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: hidden;
	}

	.viewer-shell {
		position: relative;
		flex: 1 1 auto;
		min-height: 420px;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: #f8fafc;
	}

	.viewer-host {
		position: absolute;
		inset: 0;
	}

	.viewer-host :global(.wheel-capture) {
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.viewer-host :global(.osd) {
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.viewer-empty {
		width: 100%;
		height: 100%;
		min-height: 420px;
		display: grid;
		place-items: center;
		padding: 1rem;
		box-sizing: border-box;
	}

	.viewer-empty-card {
		max-width: 420px;
		text-align: center;
		padding: 1.5rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid rgba(226, 232, 240, 0.95);
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
	}

	.viewer-empty-card h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.viewer-empty-card p {
		margin: 0;
		color: #64748b;
		line-height: 1.5;
	}

	button,
	.secondary {
		padding: 0.6rem 0.9rem;
		border-radius: 10px;
		border: 1px solid #dbe1e8;
		background: white;
		color: #0f172a;
		font: inherit;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}

	button:hover,
	.secondary:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
		border-color: #cbd5e1;
	}

	button:disabled,
	.secondary:disabled {
		cursor: not-allowed;
		opacity: 0.5;
		transform: none;
		box-shadow: none;
	}

	@media (max-width: 960px) {
		.page-shell {
			padding: 0.75rem;
		}

		.topbar-row,
		.result-head {
			flex-direction: column;
			align-items: flex-start;
		}

		.result-tools {
			justify-content: flex-start;
		}
	}

	@media (max-width: 640px) {
		.source-strip {
			width: 100%;
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.opacity-control {
			width: 100%;
			justify-content: space-between;
		}

		.opacity-control input[type='range'] {
			flex: 1;
			min-width: 0;
		}
	}
</style>
