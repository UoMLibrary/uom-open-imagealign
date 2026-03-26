<script lang="ts">
	import { loadProjectFromFile } from '$lib/services/loadService';

	async function load() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			try {
				await loadProjectFromFile(file);
			} catch {
				alert('Invalid JSON file');
			}
		};

		input.click();
	}
</script>

<button onclick={load}> Load Project </button>
