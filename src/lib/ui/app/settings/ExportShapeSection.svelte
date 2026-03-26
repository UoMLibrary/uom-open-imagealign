<script lang="ts">
	import PythonProfileSection from '$lib/ui/app/settings/PythonProfileSection.svelte';
	import { settingsState } from '$lib/core/settingsStore.svelte';
</script>

<PythonProfileSection
	title="Export Shape"
	intro="Create named Python export profiles for reshaping project data when export is run."
	profiles={settingsState.exportProfiles}
	createLabel="New export profile"
	inputLabel="Sample export payload (JSON)"
	outputLabel="Export result (JSON)"
	onCreate={() => settingsState.createExportProfile()}
	onUpdate={(id, patch) => settingsState.updateExportProfile(id, patch)}
	onDelete={(id) => settingsState.deleteExportProfile(id)}
	onDuplicate={(id) => settingsState.duplicateExportProfile(id)}
/>
