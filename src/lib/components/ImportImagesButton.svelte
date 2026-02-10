<script lang="ts">
	import { get } from 'svelte/store';
	import { hashImageFile } from '$lib/image/ImageHasher';
	import {
		images,
		addImage,
		updateImageByContentHash,
		findImageByContentHash
	} from '$lib/stores/projectStore';

	import { supportsFileSystemAccess } from '$lib/platform/fileSystem';

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
		const { contentHash, perceptualHash } = await hashImageFile(file);

		const existing = findImageByContentHash(contentHash);

		const objectUrl = URL.createObjectURL(file);

		if (existing) {
			// 🔁 Relink existing image
			updateImageByContentHash(contentHash, (img) => {
				if (img.uri.startsWith('blob:')) {
					URL.revokeObjectURL(img.uri);
				}

				return {
					...img,
					uri: objectUrl,
					label: file.name
				};
			});
			// console.log('After relink:', get(images));
		} else {
			// ➕ New image
			addImage({
				id: crypto.randomUUID(),
				sourceType: 'local',
				uri: objectUrl,
				label: file.name,
				hashes: { contentHash, perceptualHash },
				dimensions: {
					width: bitmap.width,
					height: bitmap.height
				}
			});
		}
	}
</script>

<button on:click={importImages}> Import Images </button>
