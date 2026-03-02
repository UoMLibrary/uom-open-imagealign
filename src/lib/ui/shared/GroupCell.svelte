<script lang="ts">
	import { imagesById } from '$lib/core/projectStore';
	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';

	type GroupLike = {
		id: string;
		baseImageId: string;
		imageIds: string[];
		locked?: boolean;
	};

	export let group: GroupLike;
	export let selected = false;

	// Svelte 5 callback prop
	export let onSelect: ((id: string) => void) | undefined;

	$: base = $imagesById[group.baseImageId];

	// “Target” = first non-base image in the group (for the sidebar preview)
	$: targetIds = group.imageIds.filter((id) => id !== group.baseImageId);
	$: targetId = targetIds[0] ?? null;
	$: target = targetId ? $imagesById[targetId] : null;

	$: targetCount = targetIds.length; // used for "1 of X"

	function select() {
		onSelect?.(group.id);
	}
</script>

<button
	type="button"
	class="cell"
	class:selected
	on:click={select}
	aria-label={`Group ${group.id}. ${group.imageIds.length} images.`}
>
	<div class="thumbs">
		<!-- Base (left) -->
		<div class="tile">
			{#if base}
				<ImageThumbnail
					contentHash={base.hashes?.contentHash ?? ''}
					fallbackSrc={base.runtimeUri}
					label={base.label}
					mode="thumb"
				/>
			{:else}
				<div class="thumb-fallback" aria-hidden="true"></div>
			{/if}
		</div>

		<!-- Target preview (right) -->
		<div class="tile">
			{#if target}
				<ImageThumbnail
					contentHash={target.hashes?.contentHash ?? ''}
					fallbackSrc={target.runtimeUri}
					label={target.label}
					mode="thumb"
				/>
			{:else}
				<div class="thumb-fallback" aria-hidden="true"></div>
			{/if}

			{#if targetCount > 0}
				<div class="of-badge" title="Target image position">
					1 of {targetCount}
				</div>
			{/if}
		</div>

		{#if group.locked}
			<div class="lock-badge" title="Locked">Locked</div>
		{/if}

		<div class="label-overlay">
			<span class="label">
				{base?.label ?? 'Base image'}
			</span>
			<!-- <span class="meta">
				{group.imageIds.length} images
			</span> -->
		</div>
	</div>
</button>

<style>
	/* ---------- Item container ---------- */

	.cell {
		all: unset;
		width: 100%;
		padding: 2px;
		cursor: pointer;

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.cell:focus-visible .thumbs {
		outline: 2px solid #5aa9ff;
		outline-offset: 2px;
	}

	/* Soft selection */
	.cell.selected .thumbs {
		outline: 2px solid #5aa9ff;
		outline-offset: 2px;
	}

	/* ---------- Thumbnails (2-up) ---------- */

	.thumbs {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;

		width: 100%;
		aspect-ratio: 2 / 1;

		border-radius: 10px;
		overflow: hidden;

		background: #f3f4f6;
	}

	.tile {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: white;
	}

	/* If ImageThumbnail renders an <img>, ensure it fills the tile */
	.tile :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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

	/* ---------- "1 of X" badge (top-left of right tile) ---------- */

	.of-badge {
		position: absolute;
		top: 6px;
		left: 6px;

		padding: 0 6px;
		height: 18px;
		display: grid;
		place-items: center;

		font-size: 0.65rem;
		font-weight: 700;
		line-height: 1;

		color: white;
		background: rgba(0, 0, 0, 0.7);
		border-radius: 999px;

		pointer-events: none;
	}

	/* ---------- Locked badge (top-right of whole cell) ---------- */

	.lock-badge {
		position: absolute;
		top: 6px;
		right: 6px;

		padding: 0 6px;
		height: 18px;
		display: grid;
		place-items: center;

		font-size: 0.65rem;
		font-weight: 700;
		line-height: 1;

		color: white;
		background: rgba(0, 0, 0, 0.7);
		border-radius: 999px;

		pointer-events: none;
	}

	/* ---------- Label overlay (bottom across both tiles) ---------- */

	.label-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;

		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;

		padding: 0.35rem 0.45rem;

		font-size: 0.7rem;
		font-weight: 600;

		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);

		background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));

		pointer-events: none;
	}

	.label {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		opacity: 0.9;
		white-space: nowrap;
	}

	/* ---------- Hover ---------- */

	.cell:hover .thumbs {
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08);
	}
</style>
