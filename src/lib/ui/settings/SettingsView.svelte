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
		gap: 1rem;
		padding: 1rem;
		overflow: auto;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.settings-tabs-card {
		padding: 0.85rem 1rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
	}

	.settings-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
	}

	.tab-pill {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(248, 250, 252, 0.92);
		color: #334155;
		border-radius: 999px;
		padding: 0.68rem 1rem;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background-color 140ms ease,
			color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.tab-pill:hover {
		transform: translateY(-1px);
		border-color: rgba(37, 99, 235, 0.22);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
	}

	.tab-pill.selected {
		border-color: rgba(37, 99, 235, 0.25);
		background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(219, 234, 254, 0.92));
		color: #1d4ed8;
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
	}

	.settings-content {
		min-width: 0;
		min-height: 0;
		flex: 1 1 auto;
		display: flex;
	}

	.content-shell {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}

	@media (max-width: 1000px) {
		.settings-workspace {
			padding: 0.8rem;
		}
	}

	@media (max-width: 700px) {
		.settings-tabs-card {
			padding: 0.8rem;
		}
	}
</style>
