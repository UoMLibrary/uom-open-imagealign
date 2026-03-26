<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type GroupLike = {
		id: string;
		label?: string;
		imageIds: string[];
		baseImageId?: string | null;
	};

	type Props = {
		group: GroupLike;
		selected?: boolean;
		baseImageContentHash?: string | null;
		alignmentCount?: number;
		annotationCount?: number;
		onSelect?: ((groupId: string) => void) | undefined;
	};

	let {
		group,
		selected = false,
		baseImageContentHash = null,
		alignmentCount = 0,
		annotationCount = 0,
		onSelect
	}: Props = $props();

	function getGroupLabel(group: GroupLike): string {
		return group.label?.trim?.() || group.id;
	}

	const imageCount = $derived(group.imageIds.length);
	const hasBaseImage = $derived(Boolean(group.baseImageId));

	function select() {
		onSelect?.(group.id);
	}
</script>

<button type="button" class:selected class="group-card" onclick={select}>
	<div class="group-thumb">
		{#if baseImageContentHash}
			<CachedThumb contentHash={baseImageContentHash} alt={getGroupLabel(group)} fit="cover" />
		{:else}
			<div class="thumb-fallback">No preview</div>
		{/if}

		<div class="thumb-overlay top-right">
			<span class="overlay-pill">
				{imageCount}
			</span>
		</div>
	</div>

	<div class="group-copy">
		<div class="group-title">{getGroupLabel(group)}</div>

		<div class="group-meta">
			<div>{alignmentCount} {alignmentCount === 1 ? 'alignment' : 'alignments'}</div>
			<div>{annotationCount} {annotationCount === 1 ? 'annotation' : 'annotations'}</div>
		</div>

		<div class:muted={!hasBaseImage} class="group-status">
			{#if hasBaseImage}
				Base image set
			{:else}
				No base image
			{/if}
		</div>
	</div>
</button>

<style>
	.group-card {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.06);
		background: rgba(255, 255, 255, 0.96);
		border-radius: 18px;
		padding: 0.35rem;
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 0.7rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		width: 100%;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.group-card:hover {
		border-color: rgba(59, 130, 246, 0.22);
		box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
	}

	.group-card.selected {
		border-color: rgba(37, 99, 235, 0.32);
		box-shadow: 0 10px 22px rgba(37, 99, 235, 0.08);
		background: linear-gradient(180deg, #ffffff, #f5f9ff);
	}

	.group-card:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	.group-thumb {
		position: relative;
		width: 88px;
		height: 88px;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #e5e7eb;
		align-self: stretch;
	}

	.group-copy {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.22rem;
		padding: 0.12rem 0.35rem 0.12rem 0;
	}

	.group-title {
		font-weight: 700;
		font-size: 0.92rem;
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: #111827;
		min-width: 0;
	}

	.group-meta {
		display: flex;
		flex-direction: column;
		gap: 0.08rem;
		font-size: 0.76rem;
		line-height: 1.35;
		color: #64748b;
	}

	.group-status {
		font-size: 0.76rem;
		line-height: 1.35;
		color: #111827;
		font-weight: 600;
	}

	.group-status.muted {
		color: #475569;
	}

	.thumb-overlay {
		position: absolute;
		display: flex;
		pointer-events: none;
	}

	.top-right {
		top: 0.4rem;
		right: 0.4rem;
	}

	.overlay-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.28rem 0.48rem;
		border-radius: 999px;
		background: rgba(37, 99, 235, 0.94);
		backdrop-filter: blur(6px);
		color: #ffffff;
		font-size: 0.66rem;
		font-weight: 700;
		line-height: 1;
		box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
		border-radius: 14px;
		background: rgba(248, 250, 252, 0.9);
		font-size: 0.72rem;
		padding: 0.4rem;
	}

	@media (max-width: 720px) {
		.group-card {
			grid-template-columns: 76px minmax(0, 1fr);
		}

		.group-thumb {
			width: 76px;
			height: 76px;
		}

		.group-title {
			font-size: 0.92rem;
		}
	}
</style>
