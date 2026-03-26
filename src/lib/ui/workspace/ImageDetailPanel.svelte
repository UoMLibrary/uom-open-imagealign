<script lang="ts">
	import { onDestroy } from 'svelte';
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';
	import ImageCompareViewer, {
		type ImageCompareViewerReadyPayload
	} from '$lib/ui/compare/ImageCompareViewer.svelte';
	import AnnotatedImageCompareViewer from '$lib/ui/compare/AnnotatedImageCompareViewer.svelte';

	import { getDerivedUrl } from '$lib/images/derivationService';
	import { getDerivationCacheKey } from '$lib/images/derivationState.svelte';

	type ImageLike = {
		id: string;
		contentHash: string;
		assetId?: string;
		label?: string;
		dimensions: {
			width: number;
			height: number;
		};
		metadata?: Record<string, unknown>;
	};

	type AlignmentLike = {
		status?: string;
		schemaId?: string;
		result?: {
			transformModel?: string;
		};
	} | null;

	type Props = {
		image: ImageLike;
		baseImage?: ImageLike | null;
		title?: string;
		sourceKind?: string;
		sourceValue?: string;
		isBase?: boolean;
		alignment?: AlignmentLike;
		formatValue?: ((value: unknown) => string) | undefined;
		pretty?: ((value: unknown) => string) | undefined;
	};

	let {
		image,
		baseImage = null,
		title = image.id,
		sourceKind = 'Unknown',
		sourceValue = '',
		isBase = false,
		alignment = null,
		formatValue,
		pretty
	}: Props = $props();

	let compareOpacity = $state(0.55);
	let compareMode = $state<'composite' | 'difference'>('composite');
	let drawer: 'auto' | 'canvas' | 'webgl' | 'html' | Array<string> = 'canvas';

	let baseUrl: string | null = $state(null);
	let overlayUrl: string | null = $state(null);

	let baseRelease: (() => void) | null = $state(null);
	let overlayRelease: (() => void) | null = $state(null);

	let previewState: 'idle' | 'loading' | 'ready' | 'missing' = $state('idle');
	let previewRunId = 0;
	let previewKey: string | null = $state(null);
	let panelRefreshKey = $state(0);

	function getMetadataEntries(metadata: Record<string, unknown> | null | undefined) {
		if (!metadata) return [];
		return Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b));
	}

	function renderValue(value: unknown): string {
		return formatValue?.(value) ?? String(value ?? '');
	}

	function renderPretty(value: unknown): string {
		return pretty?.(value) ?? JSON.stringify(value, null, 2);
	}

	function cleanupPreview() {
		baseRelease?.();
		baseRelease = null;

		overlayRelease?.();
		overlayRelease = null;

		baseUrl = null;
		overlayUrl = null;
	}

	async function loadPreview(nextBaseHash: string, nextOverlayHash: string) {
		const id = ++previewRunId;

		cleanupPreview();
		previewState = 'loading';

		try {
			const [baseRes, overlayRes] = await Promise.all([
				getDerivedUrl(nextBaseHash, 'work'),
				getDerivedUrl(nextOverlayHash, 'work')
			]);

			if (id !== previewRunId) {
				baseRes.release();
				overlayRes.release();
				return;
			}

			baseRelease = baseRes.release;
			overlayRelease = overlayRes.release;
			baseUrl = baseRes.url;
			overlayUrl = overlayRes.url;
			previewState = 'ready';
			panelRefreshKey += 1;
		} catch (err) {
			console.error('Error loading comparison preview', err);

			if (id !== previewRunId) return;

			cleanupPreview();
			previewState = 'missing';
		}
	}

	$effect(() => {
		const effectiveBaseHash = baseImage?.contentHash ?? image.contentHash ?? '';
		const effectiveOverlayHash = isBase ? effectiveBaseHash : (image.contentHash ?? '');

		const baseCacheKey = effectiveBaseHash ? getDerivationCacheKey(effectiveBaseHash) : '';
		const overlayCacheKey = effectiveOverlayHash ? getDerivationCacheKey(effectiveOverlayHash) : '';
		const nextKey = `${baseCacheKey}|${overlayCacheKey}|${isBase ? 'base' : 'compare'}`;

		if (nextKey === previewKey) return;
		previewKey = nextKey;

		if (!effectiveBaseHash || !effectiveOverlayHash) {
			cleanupPreview();
			previewState = 'missing';
			return;
		}

		void loadPreview(effectiveBaseHash, effectiveOverlayHash);
	});

	onDestroy(() => {
		previewRunId += 1;
		cleanupPreview();
	});

	function handleReady({ viewer, element }: ImageCompareViewerReadyPayload) {
		console.log('viewer ready', viewer, element);
	}
</script>

<section class="detail-card">
	<div class="detail-head">
		<div>
			<div class="detail-subtitle">{title}</div>
		</div>

		{#if isBase}
			<span class="pill">Base image</span>
		{:else if alignment}
			<span class="pill ok">{alignment.status}</span>
		{/if}
	</div>

	<div class="detail-layout">
		<div class="preview-column">
			<div class="preview-shell">
				{#if previewState === 'ready' && baseUrl}
					{#key `${baseUrl}:${overlayUrl ?? baseUrl}:${panelRefreshKey}`}
						<div class="viewer-shell">
							<div class="viewer-host">
								<AnnotatedImageCompareViewer
									imageUrl={baseUrl}
									overlayUrl={overlayUrl ?? baseUrl}
									initialViewState={{
										overlayOpacity: 0.6,
										annotationsVisible: true,
										annotationMode: 'pan',
										readingFocusEnabled: false,
										readingFocusClearCenterPct: 30,
										readingFocusOpacity: 0.35,
										readingFocusBlurPx: 3
									}}
								/>
							</div>
						</div>
					{/key}
				{:else if previewState === 'loading'}
					<div class="preview-state">Loading preview…</div>
				{:else}
					<div class="preview-fallback">
						<CachedThumb contentHash={image.contentHash} alt={title} />
					</div>
				{/if}
			</div>

			<div class="preview-note">
				{#if isBase}
					Base image shown against itself
				{:else}
					Base image under selected image
				{/if}
			</div>
		</div>

		<div class="detail-copy">
			<dl class="facts">
				<div class="fact-row">
					<dt>Image ID</dt>
					<dd class="mono">{image.id}</dd>
				</div>

				<div class="fact-row">
					<dt>Asset ID</dt>
					<dd>{image.assetId || '—'}</dd>
				</div>

				<div class="fact-row">
					<dt>Source kind</dt>
					<dd>{sourceKind}</dd>
				</div>

				<div class="fact-row">
					<dt>Source</dt>
					<dd class="mono wrap">{sourceValue || '—'}</dd>
				</div>

				<div class="fact-row">
					<dt>Dimensions</dt>
					<dd>{image.dimensions.width} × {image.dimensions.height}</dd>
				</div>

				<div class="fact-row">
					<dt>Content hash</dt>
					<dd class="mono wrap">{image.contentHash}</dd>
				</div>

				{#if alignment}
					<div class="fact-row">
						<dt>Alignment schema</dt>
						<dd>{alignment.schemaId ?? '—'}</dd>
					</div>

					<div class="fact-row">
						<dt>Transform model</dt>
						<dd>{alignment.result?.transformModel ?? '—'}</dd>
					</div>
				{/if}
			</dl>

			{#if getMetadataEntries(image.metadata).length > 0}
				<div class="meta-block">
					<h4>Metadata</h4>

					<dl class="facts compact">
						{#each getMetadataEntries(image.metadata) as [key, value]}
							<div class="fact-row">
								<dt>{key}</dt>
								<dd>{renderValue(value)}</dd>
							</div>
						{/each}
					</dl>
				</div>
			{/if}

			<details class="raw-block">
				<summary>Raw image record</summary>
				<pre>{renderPretty(image)}</pre>
			</details>
		</div>
	</div>
</section>

<style>
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
	.detail-card {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		box-shadow:
			0 10px 30px rgba(15, 23, 42, 0.05),
			0 2px 8px rgba(15, 23, 42, 0.04);
		padding: 1rem;
	}

	.detail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}

	.detail-subtitle {
		margin-top: 0.2rem;
		font-size: 1rem;
		font-weight: 700;
		color: #1f2937;
	}

	.detail-layout {
		display: grid;
		grid-template-columns: minmax(420px, 56%) minmax(320px, 1fr);
		gap: 1.25rem;
		align-items: start;
	}

	.preview-column {
		min-width: 0;
	}

	.preview-shell {
		height: 100%;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.preview-shell :global(*) {
		box-sizing: border-box;
	}

	.preview-fallback {
		width: 100%;
		height: 100%;
	}

	.preview-state {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.88rem;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.015));
	}

	.preview-note {
		margin-top: 0.5rem;
		font-size: 0.76rem;
		color: #64748b;
	}

	.detail-copy {
		min-width: 0;
		padding-top: 0.1rem;
	}

	.facts {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.45rem;
	}

	.facts.compact {
		margin-top: 0.45rem;
	}

	.fact-row {
		display: grid;
		grid-template-columns: 132px minmax(0, 1fr);
		gap: 0.8rem;
		align-items: start;
		padding: 0.12rem 0;
		border-bottom: 1px solid rgba(15, 23, 42, 0.05);
	}

	.fact-row:last-child {
		border-bottom: 0;
	}

	dt {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 700;
		color: #64748b;
	}

	dd {
		margin: 0;
		font-size: 0.9rem;
		color: #111827;
		line-height: 1.45;
	}

	.meta-block {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(15, 23, 42, 0.08);
	}

	.meta-block h4 {
		margin: 0 0 0.45rem;
		font-size: 0.86rem;
		color: #334155;
	}

	.raw-block {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(15, 23, 42, 0.08);
	}

	.raw-block summary {
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 700;
		color: #334155;
	}

	.raw-block pre {
		margin: 0.65rem 0 0;
		padding: 0.8rem;
		border-radius: 12px;
		background: #0f172a;
		color: #e2e8f0;
		font-size: 0.74rem;
		line-height: 1.45;
		overflow: auto;
		max-height: 260px;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		background: #eef2ff;
		color: #334155;
		border: 1px solid rgba(51, 65, 85, 0.08);
		white-space: nowrap;
	}

	.pill.ok {
		background: rgba(16, 185, 129, 0.12);
		color: #047857;
	}

	.mono,
	.wrap {
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	@media (max-width: 1100px) {
		.detail-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 700px) {
		.fact-row {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}

		.preview-shell {
			height: 320px;
		}
	}
</style>
