<script lang="ts">
	import LoadProjectButton from '$lib/shared/buttons/LoadProjectButton.svelte';
	import SaveProjectButton from '$lib/shared/buttons/SaveProjectButton.svelte';
	import ImportImagesButton from '$lib/shared/buttons/ImportImagesButton.svelte';
	import ModeTabs from '$lib/workspace/shared/ModeTabs.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();
</script>

<div class="header-wrapper">
	<header class="header">
		<div class="actions">
			<ImportImagesButton />
			<LoadProjectButton />
			<SaveProjectButton />

			<button on:click={() => dispatch('help')}>Help</button>
			<button on:click={() => dispatch('about')}>About</button>
		</div>

		<div class="title">
			<a
				href="https://github.com/UoMLibrary/uom-open-annotator/"
				target="_blank"
				rel="noopener noreferrer"
			>
				Image Alignment Tool
			</a>
		</div>
	</header>

	<!-- Mode Tabs below header line -->
	<ModeTabs />
</div>

<style>
	/* ---------- Header shell ---------- */

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;

		height: 48px;
		padding: 0 1rem;

		background: rgba(255, 255, 255, 0.97);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	/* ---------- Title ---------- */

	.title a {
		color: #111827; /* same as your header text */
		text-decoration: none;
		font-weight: 600;
	}

	.title a:hover {
		text-decoration: underline;
	}

	.title a:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	/* ---------- Action group ---------- */

	.actions {
		display: flex;
		align-items: stretch;
		overflow: hidden;
	}

	/* ---------- Action buttons (toolbar-style) ---------- */

	.actions :global(button) {
		all: unset;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0 0.9rem;
		height: 32px;

		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;

		color: #222;
		cursor: pointer;
	}

	.actions :global(button:focus-visible) {
		outline: 2px solid #4c9ffe;
		outline-offset: -2px;
	}

	.header-wrapper {
		display: flex;
		flex-direction: column;
	}
</style>
