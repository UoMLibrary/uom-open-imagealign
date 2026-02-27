<script lang="ts">
	import { groups, imagesById } from '$lib/core/projectStore';
	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';

	export let selectedGroupId: string | null = null;

	// Svelte 5 callback prop
	export let onSelect: ((id: string) => void) | undefined;

	// “Safe key” while debugging duplicates (prevents hard crash).
	// Once you’re confident IDs are unique, you can key purely by group.id again.
	$: list = $groups.map((g, idx) => ({ ...g, __key: `${g.id}:${idx}` }));

	function select(id: string) {
		onSelect?.(id);
	}
</script>

<div class="group-list">
	{#if list.length === 0}
		<div class="empty">No groups yet</div>
	{:else}
		{#each list as group (group.__key)}
			{@const base = $imagesById[group.baseImageId]}
			<button
				type="button"
				class="group-row"
				class:selected={group.id === selectedGroupId}
				on:click={() => select(group.id)}
			>
				<div class="thumb">
					{#if base}
						<ImageThumbnail
							contentHash={base.hashes?.contentHash}
							fallbackSrc={base.runtimeUri}
							label={base.label}
							mode="thumb"
						/>
					{:else}
						<div class="thumb-fallback" aria-hidden="true"></div>
					{/if}
				</div>

				<div class="info">
					<div class="title">
						Group
						<span class="count">{group.imageIds.length}</span>
					</div>

					{#if base?.label}
						<div class="subtitle">{base.label}</div>
					{:else}
						<div class="subtitle">Base image</div>
					{/if}
				</div>

				{#if group.locked}
					<div class="badge" title="Locked">Locked</div>
				{/if}
			</button>
		{/each}
	{/if}
</div>

<style>
	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
	}

	.empty {
		padding: 0.5rem;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.group-row {
		all: unset;
		cursor: pointer;
		display: grid;
		grid-template-columns: 44px 1fr auto;
		align-items: center;
		gap: 0.6rem;

		padding: 0.5rem;
		border-radius: 8px;
	}

	.group-row:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.group-row.selected {
		background: rgba(0, 0, 0, 0.08);
	}

	.thumb {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: white;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		background: repeating-linear-gradient(
			45deg,
			rgba(0, 0, 0, 0.06),
			rgba(0, 0, 0, 0.06) 6px,
			rgba(0, 0, 0, 0.02) 6px,
			rgba(0, 0, 0, 0.02) 12px
		);
	}

	.info {
		min-width: 0;
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-weight: 600;
		color: #0f172a;
		font-size: 0.85rem;
	}

	.count {
		font-weight: 600;
		color: #334155;
		font-size: 0.8rem;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
	}

	.subtitle {
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badge {
		font-size: 0.7rem;
		color: #334155;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.15rem 0.4rem;
		border-radius: 999px;
	}
</style>
