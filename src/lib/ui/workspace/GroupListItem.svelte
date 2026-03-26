<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type GroupLike = {
		id: string;
		label?: string;
		imageIds: string[];
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

	function select() {
		onSelect?.(group.id);
	}
</script>

<button type="button" class:selected class="group-card" onclick={select}>
	<div class="group-thumb">
		{#if baseImageContentHash}
			<CachedThumb contentHash={baseImageContentHash} alt={getGroupLabel(group)} />
		{:else}
			<div class="thumb-fallback">No base</div>
		{/if}
	</div>

	<div class="group-copy">
		<div class="group-title-row">
			<div class="group-title">{getGroupLabel(group)}</div>
			<div class="group-count">{group.imageIds.length} images</div>
		</div>

		<div class="group-subline">
			<span>{alignmentCount} alignments</span>
			<span>{annotationCount} annotations</span>
		</div>

		<div class="group-id">{group.id}</div>
	</div>
</button>

<style>
	.group-card {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		border-radius: 14px;
		padding: 0.65rem;
		display: grid;
		grid-template-columns: 54px minmax(0, 1fr);
		gap: 0.65rem;
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
		transform: translateY(-1px);
		border-color: rgba(59, 130, 246, 0.34);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
	}

	.group-card.selected {
		border-color: rgba(37, 99, 235, 0.48);
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.group-card:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	.group-thumb {
		width: 54px;
		height: 54px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.group-copy {
		min-width: 0;
	}

	.group-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.group-title {
		font-weight: 700;
		font-size: 0.88rem;
		color: #111827;
		min-width: 0;
	}

	.group-count,
	.group-subline,
	.group-id {
		font-size: 0.73rem;
		color: #64748b;
	}

	.group-subline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.22rem;
	}

	.group-id {
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
		border-radius: 10px;
		background: rgba(248, 250, 252, 0.9);
		font-size: 0.75rem;
		padding: 0.4rem;
	}
</style>
