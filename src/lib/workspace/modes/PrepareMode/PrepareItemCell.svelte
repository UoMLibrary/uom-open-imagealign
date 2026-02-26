<script lang="ts">
	import ImageThumbnail from '$lib/ui/features/thumbnails/ImageThumbnail.svelte';

	export let image;
	export let selected: boolean = false;
	export let confirmed: boolean = false;
	export let onSelect: () => void;

	// First 5 characters of content hash
	const shortHash = image?.hashes?.contentHash?.slice(0, 5) ?? '';
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

			<div class="badge {confirmed ? 'confirmed' : 'unconfirmed'}">
				{#if confirmed}
					✓
				{:else}
					✕
				{/if}
			</div>
		</div>

		<div class="meta">
			{image.dimensions?.width} × {image.dimensions?.height}
		</div>

		<div class="meta subtle">
			{image.sourceType}
		</div>

		<div class="hash">
			{shortHash}
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

	/* ================================================
	   Cell Layout
	================================================ */

	.cell {
		display: flex;
		align-items: stretch; /* makes image fill full height */
		padding: 0.45rem 0.6rem 0.45rem 0; /* no left padding */
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s ease;
		position: relative;
	}

	.cell:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.cell.selected {
		background: rgba(0, 0, 0, 0.07);
	}

	/* ================================================
	   Thumbnail (flush left, full height)
	================================================ */

	.thumb {
		width: 64px;
		flex-shrink: 0;
		display: flex;
		align-items: stretch;
	}

	.thumb :global(.thumb) {
		width: 100%;
		height: 100%;
	}

	.thumb :global(.image-frame) {
		height: 100%;
		padding: 0;
		border-radius: 0; /* flush */
		border: none;
		background: #f9fafb;
	}

	.thumb :global(img) {
		object-fit: cover;
		height: 100%;
		width: 100%;
	}

	/* ================================================
	   Content
	================================================ */

	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-left: 0.6rem;
		position: relative;
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

	/* ================================================
	   Badge
	================================================ */

	.badge {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		font-size: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-weight: 600;
	}

	.badge.confirmed {
		background: #22c55e;
		color: white;
	}

	.badge.unconfirmed {
		background: #9ca3af;
		color: white;
	}

	/* ================================================
	   Hash (bottom right)
	================================================ */

	.hash {
		/* position: absolute; */
		left: 0;
		bottom: 0;
		font-size: 0.65rem;
		font-weight: 700;
		color: #6b7280;
		letter-spacing: 0.03em;
	}
</style>
