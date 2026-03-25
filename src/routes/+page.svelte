<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import TransformControls from '$lib/imagealign/TransformControls.svelte';
	import ImageDropSlot from '$lib/ui/shared/ImageDropSlot.svelte';
	import AnnotatedImageCompareViewer from '$lib/ui/shared/compare/AnnotatedImageCompareViewer.svelte';

	import {
		ensureAlignmentEngine,
		runAlignmentWorkflow,
		type AlignmentSpec
	} from '$lib/imagealign/alignmentWorkflow';

	type ImageInfo = {
		width: number;
		height: number;
		size: number;
		type: string;
		name: string;
	};

	type SlotKind = 'base' | 'query';

	type AnnotationRecord = any;

	let annotations = $state<AnnotationRecord[]>([]);
	let compareViewState = $state<Record<string, unknown>>({});

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

	let engineReady = $state(false);
	let engineStatus = $state('Loading VGG alignment engine...');

	const canAlign = $derived(
		Boolean(baseFile && queryFile && baseInfo && queryInfo && engineReady && !isRunning)
	);

	const loadVersion: Record<SlotKind, number> = {
		base: 0,
		query: 0
	};

	const annotationDocument = $derived({
		annotations,
		viewState: compareViewState
	});

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
		releaseUrl(baseUrl);
		releaseUrl(queryUrl);
		releaseUrl(warpedUrl);
	});

	function releaseUrl(url: string | null) {
		if (url) URL.revokeObjectURL(url);
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
		releaseUrl(warpedUrl);
		warpedUrl = null;
		warpedRefreshKey++;
	}

	function resetSlot(kind: SlotKind) {
		if (kind === 'base') {
			baseFile = null;
			baseInfo = null;
			releaseUrl(baseUrl);
			baseUrl = null;
		} else {
			queryFile = null;
			queryInfo = null;
			releaseUrl(queryUrl);
			queryUrl = null;
		}
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

			warpedUrl = result.warpedUrl;
			warpedRefreshKey++;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Alignment failed';
		} finally {
			isRunning = false;
		}
	}
</script>

<svelte:head>
	<title>VGG Align</title>
</svelte:head>

<div class="page-shell">
	<section class="setup-panel panel">
		<div class="setup-row">
			<div class="title-wrap">
				<h1>VGG Align</h1>
				<p>Load two images, generate a transform, then inspect the result below.</p>
			</div>

			<div
				class="status-badge"
				class:ready={engineReady}
				class:error-state={!engineReady && !!error}
			>
				{engineStatus}
			</div>
		</div>

		<div class="setup-grid">
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

			<div class="transform-slot">
				<TransformControls
					{spec}
					{engineStatus}
					{isRunning}
					{canAlign}
					{error}
					onRun={runAlignment}
					onSpecChange={(nextSpec) => (spec = nextSpec)}
				/>
			</div>
		</div>
	</section>

	<section class="result-panel">
		<div class="viewer-shell">
			{#if warpedUrl && baseUrl}
				{#key `${baseUrl}:${warpedUrl}:${warpedRefreshKey}`}
					<div class="viewer-host">
						<AnnotatedImageCompareViewer
							imageUrl={baseUrl}
							overlayUrl={warpedUrl}
							{annotations}
							initialViewState={{
								overlayOpacity: 0.6,
								annotationsVisible: true,
								annotationMode: 'pan',
								readingFocusEnabled: false,
								readingFocusClearCenterPct: 30,
								readingFocusOpacity: 0.35,
								readingFocusBlurPx: 3
							}}
							refreshKey={warpedRefreshKey}
							onAnnotationsChange={(next) => (annotations = next)}
							onViewStateChange={(next) => (compareViewState = next)}
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

	.page-shell {
		min-height: 100vh;
		height: 100vh;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-sizing: border-box;
		overflow: auto;
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

	.setup-panel {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		flex: 0 0 auto;
	}

	.setup-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.setup-grid {
		display: grid;
		grid-template-columns: 148px 148px minmax(300px, 1fr);
		gap: 1rem;
		align-items: stretch;
	}

	.transform-slot {
		min-width: 0;
		display: flex;
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

	.result-panel {
		flex: 1 1 auto;
		min-height: 420px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow: hidden;
	}

	.viewer-shell {
		position: relative;
		flex: 1 1 auto;
		min-height: clamp(320px, 46vh, 760px);
		border-radius: 16px;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: #f8fafc;
		padding: 0.5rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.viewer-host {
		position: absolute;
		inset: 0.5rem;
		border-radius: 12px;
		overflow: hidden;
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

	@media (max-width: 980px) {
		.page-shell {
			height: auto;
			min-height: 100vh;
			padding: 0.75rem;
		}

		.setup-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.setup-grid {
			grid-template-columns: 148px 148px;
		}

		.transform-slot {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 640px) {
		.setup-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
