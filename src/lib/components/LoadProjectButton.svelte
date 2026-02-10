<script lang="ts">
	import { migrateProject } from '$lib/migration/migrateProject';
	import { validateProject } from '$lib/validation/validateProject';
	import { loadProject } from '$lib/stores/projectStore';

	async function load() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			const text = await file.text();
			let parsed;

			try {
				parsed = JSON.parse(text);
			} catch {
				alert('Invalid JSON file');
				return;
			}

			const migrated = migrateProject(parsed);
			const validation = validateProject(migrated);

			if (!validation.valid) {
				console.warn('Project validation warnings:', validation.errors);
				// optional: show modal/toast
			}

			loadProject(migrated);
		};

		input.click();
	}
</script>

<button on:click={load}> Load Project </button>
