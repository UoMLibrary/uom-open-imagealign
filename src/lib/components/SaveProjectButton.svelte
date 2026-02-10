<script lang="ts">
	import { get } from 'svelte/store';
	import { project } from '$lib/stores/projectStore';

	function handleSave() {
		const p = get(project);
		if (!p) return;

		const json = JSON.stringify(p, null, 2);
		const blob = new Blob([json], { type: 'application/json' });

		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'image-alignment-project.json';
		a.click();

		URL.revokeObjectURL(a.href);
	}
</script>

<button on:click={handleSave} disabled={$project === null}> Save </button>
