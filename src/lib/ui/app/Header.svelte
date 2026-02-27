<script lang="ts">
	import LoadProjectButton from '$lib/ui/shared/buttons/LoadProjectButton.svelte';
	import SaveProjectButton from '$lib/ui/shared/buttons/SaveProjectButton.svelte';
	import ImportImagesButton from '$lib/ui/shared/buttons/ImportImagesButton.svelte';
	import ModeTabs from '$lib/ui/app/ModeTabs.svelte';

	// Add callback props for Help and About actions
	export let onHelp: () => void;
	export let onAbout: () => void;

	// Handlers to call the passed-in callbacks
	function handleHelp() {
		onHelp?.();
	}
	function handleAbout() {
		onAbout?.();
	}
</script>

<div class="header-wrapper">
	<header class="header">
		<div class="actions">
			<ImportImagesButton />
			<LoadProjectButton />
			<SaveProjectButton />

			<button onclick={handleHelp}>Help</button>
			<button onclick={handleAbout}>About</button>
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

	<ModeTabs />
</div>

<style>
	/* =========================================================
   Header Layout
   ---------------------------------------------------------
   Top-level horizontal bar.
   Responsible for positioning title (left) and actions (right).
   Fixed height to keep consistent app chrome.
   ========================================================= */

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

	/* =========================================================
   Title Area
   ---------------------------------------------------------
   Styled link used as primary app title / navigation anchor.
   Focus styling ensures accessibility compliance.
   ========================================================= */

	.title a {
		color: #111827;
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

	/* =========================================================
   Actions Container
   ---------------------------------------------------------
   Right-aligned toolbar area.
   Uses flex to allow horizontal stacking of buttons.
   Overflow hidden prevents focus ring bleed.
   ========================================================= */

	.actions {
		display: flex;
		align-items: stretch;
		overflow: hidden;
	}

	/* =========================================================
   Toolbar Button Styling
   ---------------------------------------------------------
   Resets native button styles.
   Creates compact toolbar-style interaction targets.
   Scoped globally because buttons may be slotted or child components.
   ========================================================= */

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

	/* =========================================================
   Wrapper
   ---------------------------------------------------------
   Allows stacking header with optional secondary bars.
   ========================================================= */

	.header-wrapper {
		display: flex;
		flex-direction: column;
	}
</style>
