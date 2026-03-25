<script lang="ts">
	type ViewMode = 'workspace' | 'settings';

	type Props = {
		appTitle?: string;

		activeView?: ViewMode;

		canSave?: boolean;
		canExport?: boolean;
		canRelinkAssetFolder?: boolean;
		busy?: boolean;

		onShowWorkspace?: () => void;
		onShowSettings?: () => void;

		onNewFromFolder?: () => void;
		onNewFromSpreadsheet?: () => void;
		onOpenProject?: () => void;
		onRelinkAssetFolder?: () => void;
		onSave?: () => void;
		onSaveAs?: () => void;
		onExport?: () => void;
		onHelp?: () => void;
		onAbout?: () => void;
	};

	let {
		appTitle = 'Image Alignment Tool',

		activeView = 'workspace',

		canSave = false,
		canExport = false,
		canRelinkAssetFolder = false,
		busy = false,

		onShowWorkspace,
		onShowSettings,

		onNewFromFolder,
		onNewFromSpreadsheet,
		onOpenProject,
		onRelinkAssetFolder,
		onSave,
		onSaveAs,
		onExport,
		onHelp,
		onAbout
	}: Props = $props();

	let projectMenuOpen = $state(false);
	let projectMenuEl: HTMLDivElement | null = $state(null);

	function toggleProjectMenu() {
		if (busy) return;
		projectMenuOpen = !projectMenuOpen;
	}

	function closeProjectMenu() {
		projectMenuOpen = false;
	}

	function runAndClose(action?: () => void) {
		closeProjectMenu();
		action?.();
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!projectMenuOpen || !projectMenuEl) return;

		const target = event.target as Node | null;
		if (target && !projectMenuEl.contains(target)) {
			closeProjectMenu();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeProjectMenu();
		}
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div class="header-wrapper">
	<header class="header">
		<div class="header-left">
			<div class="actions">
				<div class="menu-shell" bind:this={projectMenuEl}>
					<button
						type="button"
						class="toolbar-button menu-trigger"
						class:open={projectMenuOpen}
						aria-haspopup="menu"
						aria-expanded={projectMenuOpen}
						disabled={busy}
						onclick={toggleProjectMenu}
					>
						File
					</button>

					{#if projectMenuOpen}
						<div class="menu" role="menu" aria-label="Project actions">
							<button type="button" role="menuitem" onclick={() => runAndClose(onNewFromFolder)}>
								New from Folder…
							</button>

							<button
								type="button"
								role="menuitem"
								onclick={() => runAndClose(onNewFromSpreadsheet)}
							>
								New from Spreadsheet…
							</button>

							<button type="button" role="menuitem" onclick={() => runAndClose(onOpenProject)}>
								Open Project…
							</button>

							<hr />

							<button
								type="button"
								role="menuitem"
								disabled={!canRelinkAssetFolder}
								onclick={() => runAndClose(onRelinkAssetFolder)}
							>
								Relink Asset Folder…
							</button>

							<hr />

							<button
								type="button"
								role="menuitem"
								disabled={!canSave}
								onclick={() => runAndClose(onSave)}
							>
								Save
							</button>

							<button
								type="button"
								role="menuitem"
								disabled={!canSave}
								onclick={() => runAndClose(onSaveAs)}
							>
								Save As…
							</button>

							<hr />

							<button
								type="button"
								role="menuitem"
								disabled={!canExport}
								onclick={() => runAndClose(onExport)}
							>
								Export…
							</button>
						</div>
					{/if}
				</div>

				<nav class="view-nav" aria-label="Main navigation">
					<button
						type="button"
						class="view-button"
						class:selected={activeView === 'workspace'}
						aria-current={activeView === 'workspace' ? 'page' : undefined}
						onclick={onShowWorkspace}
					>
						Workspace
					</button>

					<button
						type="button"
						class="view-button"
						class:selected={activeView === 'settings'}
						aria-current={activeView === 'settings' ? 'page' : undefined}
						onclick={onShowSettings}
					>
						Settings
					</button>
				</nav>

				<button type="button" class="toolbar-button" disabled={busy} onclick={onHelp}>Help</button>

				<button type="button" class="toolbar-button" disabled={busy} onclick={onAbout}>About</button
				>
			</div>
		</div>

		<div class="title">
			<a
				href="https://github.com/UoMLibrary/uom-open-imagealign/"
				target="_blank"
				rel="noopener noreferrer"
			>
				{appTitle}
			</a>
		</div>
	</header>
</div>

<style>
	.header-wrapper {
		display: flex;
		flex-direction: column;
		background: #fff;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
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

	.header-left {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.title {
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.title a {
		color: #111827;
		text-decoration: none;
		font-weight: 600;
		white-space: nowrap;
	}

	.title a:hover {
		text-decoration: underline;
	}

	.title a:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
		border-radius: 4px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex-wrap: wrap;
	}

	.menu-shell {
		position: relative;
	}

	.toolbar-button,
	.view-button {
		appearance: none;
		border: 0;
		background: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		padding: 0 0.85rem;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: #1f2937;
		cursor: pointer;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}

	.toolbar-button:hover:not(:disabled),
	.menu-trigger.open,
	.view-button:hover:not(:disabled),
	.view-button.selected {
		background: #f3f4f6;
	}

	.view-nav {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.1rem;
		margin-left: 0.2rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.035);
	}

	.view-button.selected {
		color: #111827;
		box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
	}

	.toolbar-button:disabled,
	.view-button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.toolbar-button:focus-visible,
	.view-button:focus-visible,
	.menu button:focus-visible {
		outline: 2px solid #4c9ffe;
		outline-offset: 2px;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 30;
		min-width: 220px;
		padding: 0.35rem;
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		box-shadow:
			0 10px 25px rgba(0, 0, 0, 0.12),
			0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.menu button {
		appearance: none;
		border: 0;
		background: transparent;
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.65rem 0.75rem;
		border-radius: 8px;
		text-align: left;
		font: inherit;
		font-size: 0.86rem;
		color: #111827;
		cursor: pointer;
	}

	.menu button:hover:not(:disabled) {
		background: #f3f4f6;
	}

	.menu button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.menu hr {
		margin: 0.35rem 0;
		border: 0;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}

	@media (max-width: 900px) {
		.header {
			height: auto;
			min-height: 48px;
			padding-top: 0.4rem;
			padding-bottom: 0.4rem;
			align-items: flex-start;
			flex-direction: column;
		}

		.header-left,
		.actions {
			width: 100%;
		}

		.title {
			justify-content: flex-start;
		}
	}
</style>
