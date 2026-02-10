<script lang="ts">
	import { get } from 'svelte/store';
	import { hashWithWorker } from '$lib/image/ImageHasher';
	import { addImage, updateImageByContentHash, images } from '$lib/stores/projectStore';
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

		const existing = get(images).find((img) => img.hashes.contentHash === contentHash);

		const objectUrl = URL.createObjectURL(file);

		if (existing) {
			// 🔁 Relink existing image
			updateImageByContentHash(contentHash, (img) => ({
				...img,
				uri: objectUrl,
				label: file.name
			}));
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
