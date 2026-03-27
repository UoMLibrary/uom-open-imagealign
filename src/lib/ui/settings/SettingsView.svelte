<script lang="ts">
	import ImportGroupingSection from '$lib/ui/settings/sections/ImportGroupingSection.svelte';
	import AnnotationSchemaSection from '$lib/ui/settings/sections/AnnotationSchemaSection.svelte';
	import ExportShapeSection from '$lib/ui/settings/sections/ExportShapeSection.svelte';
	import StorageUsage from '$lib/ui/settings/sections/StorageUsage.svelte';
	import AppConfigSection from '$lib/ui/settings/sections/AppConfigSection.svelte';
	import { settingsState } from '$lib/config/settingsStore.svelte';
	import { appConfigState } from '$lib/config/appConfigStore.svelte';

	type SettingsTab = 'grouping' | 'annotation' | 'export' | 'storage' | 'config';

	type TabMeta = {
		id: SettingsTab;
		label: string;
	};

	const tabs: TabMeta[] = [
		{
			id: 'grouping',
			label: 'Import Grouping'
		},
		{
			id: 'annotation',
			label: 'Annotation Data Shape'
		},
		{
			id: 'export',
			label: 'Export Shape'
		},
		{
			id: 'storage',
			label: 'Storage'
		},
		{
			id: 'config',
			label: 'Application Config'
		}
	];

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
	<div class="settings-tabs-card">
		<div class="settings-tabs" role="tablist" aria-label="Settings categories">
			{#each tabs as tab}
				<button
					type="button"
					role="tab"
					class="tab-pill"
					class:selected={activeTab === tab.id}
					aria-selected={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<section class="settings-content">
		<div class="content-shell">
			{#if activeTab === 'grouping'}
				<ImportGroupingSection />
			{:else if activeTab === 'annotation'}
				<AnnotationSchemaSection />
			{:else if activeTab === 'export'}
				<ExportShapeSection />
			{:else if activeTab === 'storage'}
				<StorageUsage />
			{:else}
				<AppConfigSection onReset={resetAllSettings} />
			{/if}
		</div>
	</section>
</div>

<style>
	.settings-workspace {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		overflow: hidden;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.settings-tabs-card {
		display: flex;
		align-items: center;
		min-height: 48px;
		padding: 0 0.8rem;
		background: rgba(255, 255, 255, 0.97);
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
	}

	.settings-tabs {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.1rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.035);
		overflow-x: auto;
		max-width: 100%;
	}

	.tab-pill {
		appearance: none;
		border: 0;
		background: transparent;
		color: #1f2937;
		border-radius: 8px;
		height: 32px;
		padding: 0 0.9rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 140ms ease,
			color 140ms ease,
			box-shadow 140ms ease;
	}

	.tab-pill:hover {
		background: #f3f4f6;
	}

	.tab-pill.selected {
		background: #f3f4f6;
		color: #111827;
		box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
	}

	.settings-content {
		min-width: 0;
		min-height: 0;
		flex: 1 1 auto;
		display: flex;
		overflow: hidden;
	}

	.content-shell {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	@media (max-width: 1000px) {
		.settings-tabs-card {
			padding: 0 0.55rem;
		}
	}

	@media (max-width: 700px) {
		.settings-tabs-card {
			padding: 0 0.45rem;
		}
	}
</style>
