<script>
	import { createEventDispatcher } from 'svelte';
	import { supportsFileSystemAccess } from '$lib/components/projectIO';

	const dispatch = createEventDispatcher();

	async function load() {
		if (supportsFileSystemAccess()) {
			const dir = await window.showDirectoryPicker();
			const files = new Map();

			for await (const entry of dir.values()) {
				if (entry.kind === 'file') {
					const file = await entry.getFile();
					files.set(file.name, file);
				}
			}

			dispatch('load', { files, dir });
		} else {
			const input = document.createElement('input');
			input.type = 'file';
			input.webkitdirectory = true;
			input.multiple = true;

			input.onchange = () => {
				const files = new Map(Array.from(input.files).map((f) => [f.name, f]));
				dispatch('load', { files, dir: null });
			};

			input.click();
		}
	}
</script>

<button on:click={load}> Load </button>
