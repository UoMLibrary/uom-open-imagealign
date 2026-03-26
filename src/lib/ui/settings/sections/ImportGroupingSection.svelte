<script lang="ts">
	import PythonProfileSection from '$lib/ui/settings/sections/PythonProfileSection.svelte';
	import { settingsState } from '$lib/core/settingsStore.svelte';
</script>

<PythonProfileSection
	title="Import Grouping"
	intro="Create named Python grouping profiles for folder imports. These receive a clean file manifest and return proposed groups."
	profiles={settingsState.importGroupingProfiles}
	createLabel="New grouping profile"
	inputLabel="Sample folder manifest (JSON)"
	outputLabel="Grouping result (JSON)"
	onCreate={() => settingsState.createImportGroupingProfile()}
	onUpdate={(id, patch) => settingsState.updateImportGroupingProfile(id, patch)}
	onDelete={(id) => settingsState.deleteImportGroupingProfile(id)}
	onDuplicate={(id) => settingsState.duplicateImportGroupingProfile(id)}
/>
