<script lang="ts">
	import ImageThumbnail from '$lib/ui/features/thumbnails/ImageThumbnail.svelte';

	export let image;
	export let selected: boolean = false;
	export let confirmed: boolean = false;
	export let onSelect: () => void;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="cell {selected ? 'selected' : ''}" on:click={onSelect}>
	<div class="thumb">
		<ImageThumbnail
			contentHash={image.hashes?.contentHash}
			fallbackSrc={image.runtimeUri}
			mode="thumb"
		/>
	</div>

	<div class="content">
		<div class="title-row">
			<div class="title">
				{image.label ?? image.id}
			</div>

			{#if confirmed}
				<div class="badge">✓</div>
			{/if}
		</div>

		<div class="meta">
			{image.dimensions?.width} × {image.dimensions?.height}
		</div>

		<div class="meta subtle">
			{image.sourceType}
		</div>
	</div>
</div>

<style>
	:global(body) {
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif;
	}

	.cell {
		display: flex;
		gap: 0.65rem;
		padding: 0.45rem 0.6rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.cell:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.cell.selected {
		background: rgba(0, 0, 0, 0.07);
	}

	/* Thumbnail */
	.thumb {
		width: 52px;
		height: 52px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.thumb :global(.thumb) {
		width: 100%;
		height: 100%;
	}

	.thumb :global(.image-frame) {
		height: 100%;
		padding: 0;
		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		background: #f9fafb;
	}

	.thumb :global(img) {
		object-fit: cover;
	}

	/* Content */
	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.title {
		font-size: 0.82rem;
		font-weight: 600;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		font-size: 0.7rem;
		color: #4b5563;
	}

	.meta.subtle {
		color: #9ca3af;
	}

	.badge {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #22c55e;
		color: white;
		font-size: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
</style>
