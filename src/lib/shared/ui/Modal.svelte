<script>
	import { createEventDispatcher, onMount } from 'svelte';

	export let open = false;
	export let title = '';

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}

	function onKey(e) {
		if (e.key === 'Escape') close();
	}

	onMount(() => {
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if open}
	<div class="backdrop" on:click={close}>
		<div class="modal" on:click|stopPropagation>
			<header class="modal-header">
				<div class="modal-title">
					{#if title}
						{title}
					{/if}
				</div>

				<button class="close-button" aria-label="Close" on:click={close}> × </button>
			</header>

			<div class="modal-body">
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	/* ---------- Backdrop ---------- */

	.backdrop {
		position: fixed;
		inset: 0;

		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(2px);

		display: grid;
		place-items: center;

		z-index: 1000;
	}

	/* ---------- Modal shell ---------- */

	.modal {
		display: flex;
		flex-direction: column;

		max-width: 520px;
		width: calc(100% - 2rem);
		max-height: calc(100vh - 4rem);

		background: white;
		border-radius: 12px;

		box-shadow:
			0 20px 40px rgba(0, 0, 0, 0.2),
			0 2px 8px rgba(0, 0, 0, 0.15);

		overflow: hidden;

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	/* ---------- Header ---------- */

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;

		/* compact header */
		padding: 0.5rem 0.75rem;

		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}

	.modal-title {
		font-size: 1.15rem;
		font-weight: 650; /* subtle bump */
		color: #111827;
		letter-spacing: 0.01em;
	}

	/* ---------- Close button ---------- */

	.close-button {
		all: unset;

		/* visual size */
		font-size: 1.1rem;
		line-height: 1;

		/* large hit area */
		width: 36px;
		height: 36px;

		display: grid;
		place-items: center;

		cursor: pointer;
		color: #444;

		border-radius: 8px;
	}

	.close-button:hover {
		background: rgba(0, 0, 0, 0.08);
	}

	.close-button:active {
		background: rgba(0, 0, 0, 0.12);
	}

	.close-button:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	/* ---------- Body ---------- */

	/* ---------- Modal body content defaults ---------- */

	.modal-body {
		padding: 1rem 1.25rem;
		overflow: auto;

		font-size: 0.85rem;
		line-height: 1.5;
		color: #1f2937;
	}

	/* paragraphs */
	.modal-body p {
		margin: 0 0 0.75rem;
	}

	/* lists */
	.modal-body ul {
		margin: 0.5rem 0 0.75rem 1.25rem;
		padding: 0;
	}

	.modal-body li {
		margin-bottom: 0.4rem;
	}

	/* headings inside modal body */
	.modal-body h3 {
		margin: 0.9rem 0 0.4rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280; /* lighter */
	}

	/* keyboard keys */
	.modal-body kbd {
		display: inline-block;
		padding: 0.1rem 0.35rem;
		margin: 0 0.15rem;
		font-size: 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;

		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;

		box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.1);
	}

	/* separators */
	.modal-body hr {
		border: none;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		margin: 0.75rem 0;
	}
</style>
