<script lang="ts">
	import { hashWithWorker } from '$lib/image/ImageHasher';
	import { addImage } from '$lib/stores/projectStore';
	import { supportsFileSystemAccess } from '$lib/components/projectIO';

	async function importImages() {
		if (supportsFileSystemAccess()) {
			const dir = await (window as any).showDirectoryPicker();

			for await (const entry of dir.values()) {
				if (entry.kind !== 'file') continue;

				const file = await entry.getFile();
				if (!file.type.startsWith('image/')) continue;

				await ingestFile(file);
			}
		} else {
			const input = document.createElement('input');
			input.type = 'file';
			input.webkitdirectory = true;
			input.multiple = true;

			input.onchange = async () => {
				for (const file of Array.from(input.files ?? [])) {
					if (!file.type.startsWith('image/')) continue;
					await ingestFile(file);
				}
			};

			input.click();
		}
	}

	async function ingestFile(file: File) {
		const bitmap = await createImageBitmap(file);
		const { contentHash, perceptualHash } = await hashWithWorker(bitmap);

		addImage({
			id: crypto.randomUUID(),
			sourceType: 'local',
			uri: URL.createObjectURL(file),
			label: file.name,
			hashes: { contentHash, perceptualHash },
			dimensions: {
				width: bitmap.width,
				height: bitmap.height
			}
		});
	}
</script>

<button on:click={importImages}> Import Images </button>
