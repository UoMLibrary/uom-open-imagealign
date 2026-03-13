<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type ImageLike = {
		id: string;
		contentHash: string;
		dimensions: {
			width: number;
			height: number;
		};
	};

	type Props = {
		image: ImageLike;
		title?: string;
		sourceKind?: string;
		sourceValue?: string;
		selected?: boolean;
		isBase?: boolean;
		alignmentStatus?: string | null;
		onSelect?: ((imageId: string) => void) | undefined;
	};

	let {
		image,
		title = image.id,
		sourceKind = 'Unknown',
		sourceValue = '',
		selected = false,
		isBase = false,
		alignmentStatus = null,
		onSelect
	}: Props = $props();

	function select() {
		onSelect?.(image.id);
	}
</script>

<button type="button" class="image-card" class:selected class:base={isBase} onclick={select}>
	<div class="image-thumb">
		<CachedThumb contentHash={image.contentHash} alt={title} />
	</div>

	<div class="image-copy">
		<div class="image-title-row">
			<div class="image-title">{title}</div>

			{#if isBase}
				<span class="badge base">Base</span>
			{:else if alignmentStatus}
				<span class="badge ok">{alignmentStatus}</span>
			{:else}
				<span class="badge muted">Unaligned</span>
			{/if}
		</div>

		<div class="image-subline">
			{sourceKind} · {image.dimensions.width} × {image.dimensions.height}
		</div>

		<div class="image-path">{sourceValue}</div>

		<div class="image-hash">hash: {image.contentHash}</div>
	</div>
</button>

<style>
	.image-card {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		border-radius: 14px;
		padding: 0.75rem;
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 0.75rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		width: 100%;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.image-card:hover {
		transform: translateY(-1px);
		border-color: rgba(59, 130, 246, 0.34);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
	}

	.image-card.selected {
		border-color: rgba(37, 99, 235, 0.48);
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.image-card.base {
		border-left: 4px solid #2563eb;
	}

	.image-card:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	.image-thumb {
		width: 88px;
		height: 88px;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.image-copy {
		min-width: 0;
	}

	.image-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.image-title {
		font-size: 0.88rem;
		font-weight: 700;
		color: #111827;
		min-width: 0;
	}

	.image-subline,
	.image-path,
	.image-hash {
		font-size: 0.73rem;
		color: #64748b;
	}

	.image-subline {
		margin-top: 0.24rem;
	}

	.image-path,
	.image-hash {
		margin-top: 0.18rem;
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.badge {
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

	.badge.ok {
		background: rgba(16, 185, 129, 0.12);
		color: #047857;
	}

	.badge.base {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.badge.muted {
		background: rgba(148, 163, 184, 0.12);
		color: #64748b;
	}
</style>
