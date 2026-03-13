<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type ImageLike = {
		id: string;
		contentHash: string;
		assetId?: string;
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
		title = image.id,
		sourceKind = 'Unknown',
		sourceValue = '',
		isBase = false,
		alignment = null,
		formatValue,
		pretty
	}: Props = $props();

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
</script>

<section class="detail-card">
	<div class="detail-head">
		<h3>Selected image</h3>

		{#if isBase}
			<span class="pill">Base image</span>
		{:else if alignment}
			<span class="pill ok">{alignment.status}</span>
		{/if}
	</div>

	<div class="detail-layout">
		<div class="detail-thumb">
			<CachedThumb contentHash={image.contentHash} alt={title} />
		</div>

		<div class="detail-copy">
			<div class="detail-title">{title}</div>

			<div class="kv-grid">
				<div class="kv-item">
					<div class="kv-key">Image ID</div>
					<div class="kv-value code">{image.id}</div>
				</div>

				<div class="kv-item">
					<div class="kv-key">Asset ID</div>
					<div class="kv-value">{image.assetId || '—'}</div>
				</div>

				<div class="kv-item">
					<div class="kv-key">Source kind</div>
					<div class="kv-value">{sourceKind}</div>
				</div>

				<div class="kv-item">
					<div class="kv-key">Source</div>
					<div class="kv-value code wrap">{sourceValue}</div>
				</div>

				<div class="kv-item">
					<div class="kv-key">Dimensions</div>
					<div class="kv-value">{image.dimensions.width} × {image.dimensions.height}</div>
				</div>

				<div class="kv-item">
					<div class="kv-key">Content hash</div>
					<div class="kv-value code wrap">{image.contentHash}</div>
				</div>

				{#if alignment}
					<div class="kv-item">
						<div class="kv-key">Alignment schema</div>
						<div class="kv-value">{alignment.schemaId}</div>
					</div>

					<div class="kv-item">
						<div class="kv-key">Transform model</div>
						<div class="kv-value">{alignment.result?.transformModel ?? '—'}</div>
					</div>
				{/if}
			</div>

			{#if getMetadataEntries(image.metadata).length > 0}
				<div class="meta-block">
					<h4>Metadata</h4>

					<div class="kv-grid compact">
						{#each getMetadataEntries(image.metadata) as [key, value]}
							<div class="kv-item">
								<div class="kv-key">{key}</div>
								<div class="kv-value">{renderValue(value)}</div>
							</div>
						{/each}
					</div>
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
		gap: 0.75rem;
	}

	.detail-head h3,
	.detail-title {
		margin: 0;
		color: #111827;
	}

	.detail-thumb {
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
		width: 180px;
		height: 180px;
	}

	.detail-layout {
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		gap: 1rem;
		margin-top: 0.85rem;
	}

	.detail-copy {
		min-width: 0;
	}

	.detail-title {
		font-size: 0.95rem;
		font-weight: 700;
		margin-bottom: 0.7rem;
	}

	.kv-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.kv-grid.compact {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 0.55rem;
	}

	.kv-item {
		padding: 0.6rem 0.7rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.06);
		min-width: 0;
	}

	.kv-key {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.22rem;
	}

	.kv-value {
		font-size: 0.84rem;
		color: #111827;
	}

	.meta-block {
		margin-top: 0.9rem;
	}

	.meta-block h4 {
		margin: 0 0 0.45rem;
		font-size: 0.82rem;
		color: #334155;
	}

	.raw-block {
		margin-top: 0.8rem;
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

	.code,
	.wrap,
	code {
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	@media (max-width: 900px) {
		.detail-layout {
			grid-template-columns: 1fr;
		}

		.kv-grid,
		.kv-grid.compact {
			grid-template-columns: 1fr;
		}
	}
</style>
