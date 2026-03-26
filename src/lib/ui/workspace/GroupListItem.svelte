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
	const expectedAlignmentCount = $derived(Math.max(imageCount - (hasBaseImage ? 1 : 0), 0));
	const countTone = $derived.by(() => {
		if (!hasBaseImage && alignmentCount === 0) return 'danger';
		if (hasBaseImage && expectedAlignmentCount > 0 && alignmentCount >= expectedAlignmentCount) {
			return 'success';
		}
		if (hasBaseImage && alignmentCount === 0) return 'warning';
		return 'neutral';
	});

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
	</div>

	<div class="group-copy">
		<div class="group-title-row">
			<div class="group-title" title={getGroupLabel(group)}>{getGroupLabel(group)}</div>
			<span class={`count-pill ${countTone}`}>{imageCount}</span>
		</div>

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
		border: none;
		border-radius: 0;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: transparent;
		padding: 0.45rem 0.1rem;
		display: grid;
		grid-template-columns: 78px minmax(0, 1fr);
		gap: 0.8rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		width: 100%;
		transition:
			background-color 140ms ease,
			color 140ms ease;
	}

	.group-card:hover {
		background: rgba(248, 250, 252, 0.72);
	}

	.group-card.selected {
		background: rgba(239, 246, 255, 0.72);
	}

	.group-card:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	.group-thumb {
		position: relative;
		width: 78px;
		height: 78px;
		border-radius: 2px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.16);
		background:
			linear-gradient(180deg, rgba(229, 231, 235, 0.95), rgba(241, 245, 249, 0.98));
		align-self: stretch;
	}

	.group-copy {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.14rem;
		padding: 0.05rem 0.2rem 0.05rem 0;
	}

	.group-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.group-title {
		font-weight: 700;
		font-size: 0.92rem;
		line-height: 1.12;
		letter-spacing: -0.01em;
		color: #111827;
		min-width: 0;
		flex: 1 1 auto;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count-pill {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.75rem;
		padding: 0.18rem 0.42rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1;
		border: 1px solid transparent;
	}

	.count-pill.success {
		background: #8cd47e;
		color: #ffffff;
		border-color: #8cd47e;
	}

	.count-pill.warning {
		background: #ffb54c;
		color: #ffffff;
		border-color: #ffb54c;
	}

	.count-pill.danger {
		background: #ffb54c;
		color: #ffffff;
		border-color: #ffb54c;
	}

	.count-pill.neutral {
		background: #e8edf3;
		color: #556274;
		border-color: #d5dde7;
	}

	.group-meta {
		display: flex;
		flex-direction: column;
		gap: 0.02rem;
		font-size: 0.74rem;
		line-height: 1.28;
		color: #5b677a;
	}

	.group-status {
		font-size: 0.75rem;
		line-height: 1.25;
		color: #111827;
		font-weight: 600;
		margin-top: 0.05rem;
	}

	.group-status.muted {
		color: #6b7280;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
		border-radius: 2px;
		background: linear-gradient(180deg, rgba(229, 231, 235, 0.95), rgba(241, 245, 249, 0.98));
		font-size: 0.72rem;
		padding: 0.4rem;
	}

	@media (max-width: 720px) {
		.group-card {
			grid-template-columns: 68px minmax(0, 1fr);
		}

		.group-thumb {
			width: 68px;
			height: 68px;
		}

		.group-title {
			font-size: 0.92rem;
		}
	}
</style>
