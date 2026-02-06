<script>
	import { createEventDispatcher } from 'svelte';

	export let pair;
	export let selected = false;

	const dispatch = createEventDispatcher();
</script>

<div class="pair-item" class:selected on:click={() => dispatch('select')}>
	<div class="thumbs">
		<img src={pair.thumbAUrl} alt="Image A" />
		<img src={pair.thumbAUrl} alt="Image B" />

		{#if pair.annotations.length > 0}
			<div class="count-badge">
				{pair.annotations.length}
			</div>
		{/if}

		<div class="label-overlay">
			{pair.label || pair.id}
		</div>
	</div>
</div>

<style>
	/* ---------- Item container ---------- */

	.pair-item {
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

	/* Soft selection */
	.pair-item.selected .thumbs {
		outline: 2px solid #5aa9ff;
		outline-offset: 2px;
	}

	/* ---------- Thumbnails ---------- */

	.thumbs {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;

		width: 100%;
		aspect-ratio: 2 / 1;

		border-radius: 8px;
		overflow: hidden;

		background: #f3f4f6; /* neutral, not black */
	}

	.thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ---------- Annotation count badge ---------- */

	.count-badge {
		position: absolute;
		top: 6px;
		right: 6px;

		min-width: 18px;
		height: 18px;
		padding: 0 5px;

		display: grid;
		place-items: center;

		font-size: 0.65rem;
		font-weight: 700;
		line-height: 1;

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;

		color: white;
		background: rgba(0, 0, 0, 0.7);

		border-radius: 999px;
		pointer-events: none;
	}

	/* ---------- Label overlay ---------- */

	.label-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;

		padding: 0.35rem 0.45rem;

		font-size: 0.7rem;
		font-weight: 600;

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;

		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);

		background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));

		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---------- Hover ---------- */

	.pair-item:hover .thumbs {
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08);
	}
</style>
