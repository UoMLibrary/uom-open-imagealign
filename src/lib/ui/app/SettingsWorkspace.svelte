<script lang="ts">
	import ImportGroupingSection from '$lib/ui/app/settings/ImportGroupingSection.svelte';
	import AnnotationSchemaSection from '$lib/ui/app/settings/AnnotationSchemaSection.svelte';
	import ExportShapeSection from '$lib/ui/app/settings/ExportShapeSection.svelte';
	import StorageUsage from '$lib/ui/app/settings/StorageUsage.svelte';
	import AppConfigSection from '$lib/ui/app/settings/AppConfigSection.svelte';
	import { settingsState } from '$lib/core/settingsStore.svelte';
	import { appConfigState } from '$lib/core/appConfigStore.svelte';

	type SettingsTab = 'grouping' | 'annotation' | 'export' | 'storage' | 'config';

	let activeTab = $state<SettingsTab>('grouping');

	function resetAllSettings() {
		const ok = window.confirm(
			'Reset saved settings and application config back to defaults? This will remove your custom grouping, annotation, export, and app configuration preferences.'
		);

		if (ok) {
			settingsState.resetAll();
			appConfigState.reset();
			activeTab = 'grouping';
		}
	}
</script>

<div class="settings-workspace">
	<div class="settings-header">
		<div>
			<h1>Settings</h1>
			<p>
				Manage reusable profiles, browser-side storage, and shared application configuration from
				one place.
			</p>
		</div>

		<div class="settings-actions">
			<button type="button" class="ghost-button" onclick={resetAllSettings}
				>Reset to defaults</button
			>
		</div>
	</div>

	<div class="settings-layout">
		<aside class="settings-nav">
			<button
				type="button"
				class="nav-item"
				class:selected={activeTab === 'grouping'}
				onclick={() => (activeTab = 'grouping')}
			>
				<div class="nav-title">Import Grouping</div>
				<div class="nav-sub">Python functions used when creating projects from folders</div>
			</button>

			<button
				type="button"
				class="nav-item"
				class:selected={activeTab === 'annotation'}
				onclick={() => (activeTab = 'annotation')}
			>
				<div class="nav-title">Annotation Data Shape</div>
				<div class="nav-sub">JSON schema profiles for annotation forms and data</div>
			</button>

			<button
				type="button"
				class="nav-item"
				class:selected={activeTab === 'export'}
				onclick={() => (activeTab = 'export')}
			>
				<div class="nav-title">Export Shape</div>
				<div class="nav-sub">Python functions for reshaping project data for export</div>
			</button>

			<button
				type="button"
				class="nav-item"
				class:selected={activeTab === 'storage'}
				onclick={() => (activeTab = 'storage')}
			>
				<div class="nav-title">Storage</div>
				<div class="nav-sub">Inspect and clear IndexedDB cache and saved browser-side app data</div>
			</button>

			<button
				type="button"
				class="nav-item"
				class:selected={activeTab === 'config'}
				onclick={() => (activeTab = 'config')}
			>
				<div class="nav-title">Application Config</div>
				<div class="nav-sub">Shared browser-side preferences used across the application</div>
			</button>
		</aside>

		<section class="settings-content">
			{#if activeTab === 'grouping'}
				<ImportGroupingSection />
			{:else if activeTab === 'annotation'}
				<AnnotationSchemaSection />
			{:else if activeTab === 'export'}
				<ExportShapeSection />
			{:else if activeTab === 'storage'}
				<StorageUsage />
			{:else}
				<AppConfigSection />
			{/if}
		</section>
	</div>
</div>

<style>
	.settings-workspace {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		overflow: auto;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.settings-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
	}

	.settings-header h1 {
		margin: 0 0 0.35rem;
		font-size: 1.25rem;
		color: #111827;
	}

	.settings-header p {
		margin: 0;
		color: #64748b;
		font-size: 0.9rem;
		line-height: 1.5;
		max-width: 62rem;
	}

	.settings-layout {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 1rem;
		min-height: 0;
		flex: 1 1 auto;
	}

	.settings-nav,
	.settings-content {
		min-height: 0;
	}

	.settings-nav {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.nav-item {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.94);
		border-radius: 16px;
		padding: 0.95rem 1rem;
		text-align: left;
		cursor: pointer;
		transition:
			transform 120ms ease,
			border-color 120ms ease,
			background-color 120ms ease,
			box-shadow 120ms ease;
	}

	.nav-item:hover {
		transform: translateY(-1px);
		border-color: rgba(59, 130, 246, 0.18);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
	}

	.nav-item.selected {
		border-color: rgba(59, 130, 246, 0.32);
		background: rgba(239, 246, 255, 0.9);
		box-shadow: 0 8px 20px rgba(59, 130, 246, 0.08);
	}

	.nav-title {
		font-size: 0.92rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.25rem;
	}

	.nav-sub {
		font-size: 0.8rem;
		color: #64748b;
		line-height: 1.45;
	}

	.settings-content {
		min-width: 0;
	}

	.ghost-button {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		color: #111827;
		padding: 0.65rem 0.9rem;
		border-radius: 10px;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
	}

	.ghost-button:hover {
		background: #f8fafc;
	}

	@media (max-width: 1000px) {
		.settings-layout {
			grid-template-columns: 1fr;
		}

		.settings-nav {
			display: grid;
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 700px) {
		.settings-header {
			flex-direction: column;
		}
	}
</style>
