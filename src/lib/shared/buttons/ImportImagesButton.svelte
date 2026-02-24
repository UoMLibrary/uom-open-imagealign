<script lang="ts">
	import { hashImageFile } from '$lib/domain/image/ImageHasher';
	import {
		addImage,
		updateImageByContentHash,
		findImageByContentHash
	} from '$lib/domain/project/projectStore';
	import { ensureWorkingImage, ensureThumbnail } from '$lib/domain/image/ImageDerivationStore';
	import { supportsFileSystemAccess } from '$lib/infrastructure/fileSystem';
	import { computePHashFromNormalised } from '$lib/domain/image/PerceptualHash';
	import type { ImagePreparation } from '$lib/domain/project/types';

	let ingesting = false;
	let ingestProgress = 0;
	let ingestTotal = 0;

	async function importImages() {
		const filesToProcess: { file: File; structuralPath?: string }[] = [];

		if (supportsFileSystemAccess()) {
			const dir = await (window as any).showDirectoryPicker();
			await collectFromDirectory(dir, filesToProcess);
		} else {
			const input = document.createElement('input');
			input.type = 'file';
			input.webkitdirectory = true;
			input.multiple = true;

			input.onchange = async () => {
				for (const file of Array.from(input.files ?? [])) {
					if (!file.type.startsWith('image/')) continue;
					const structuralPath = (file as any).webkitRelativePath;
					filesToProcess.push({ file, structuralPath });
				}

				await processFiles(filesToProcess);
			};

			input.click();
			return;
		}

		await processFiles(filesToProcess);
	}

	async function collectFromDirectory(
		dirHandle: any,
		files: { file: File; structuralPath?: string }[],
		parentPath = ''
	) {
		for await (const entry of dirHandle.values()) {
			const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

			if (entry.kind === 'directory') {
				await collectFromDirectory(entry, files, currentPath);
			}

			if (entry.kind === 'file') {
				const file = await entry.getFile();
				if (!file.type.startsWith('image/')) continue;
				files.push({ file, structuralPath: currentPath });
			}
		}
	}

	async function processFiles(items: { file: File; structuralPath?: string }[]) {
		if (!items.length) return;

		ingestTotal = items.length;
		ingestProgress = 0;
		ingesting = true;

		const concurrency = 1; // Anything greater than 1 causes race conditions in the current implementation due to shared state mutations. Can be improved with better state management.
		const queue = [...items]; // clone

		let completed = 0;

		async function worker() {
			while (queue.length > 0) {
				const item = queue.shift();
				if (!item) break;

				try {
					await ingestFile(item.file, item.structuralPath);
				} catch (err) {
					console.error('Ingest failed:', item.file.name, err);
				}

				completed++;
				ingestProgress = Math.round((completed / ingestTotal) * 100);
			}
		}

		const workers = Array.from({ length: concurrency }, () => worker());

		await Promise.all(workers);

		ingesting = false;
	}

	async function ingestFile(file: File, structuralPath?: string) {
		// Warn when unsupported file type is encountered, but continue processing other files
		if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
			console.warn('Unsupported image type:', file.name);
			return;
		}

		// 1️⃣ Hash original file bytes
		const { contentHash } = await hashImageFile(file);

		const existing = findImageByContentHash(contentHash);
		if (existing) {
			console.log('Duplicate content hash:', file.name);
		}

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
					label: file.name,
					structuralPath
				};
			});
		} else {
			// 2️⃣ Create bitmap only for new images
			const bitmap = await createImageBitmap(file);

			const defaultPreparation: ImagePreparation = {
				rotation: 0,
				rect: { x: 0, y: 0, width: 1, height: 1 }
			};

			// 1️⃣ Build bounded working image
			await ensureWorkingImage(contentHash, file);

			// 2️⃣ Build thumbnail from working
			await ensureThumbnail(contentHash);

			// 3️⃣ now add image fully ready
			addImage({
				id: crypto.randomUUID(),
				sourceType: 'local',
				uri: objectUrl,
				label: file.name,
				structuralPath,
				hashes: {
					contentHash,
					perceptualHash: undefined // will be computed later from normalised image
				},
				dimensions: {
					width: bitmap.width,
					height: bitmap.height
				},
				preparation: defaultPreparation,
				workflow: {
					stage: 'ingested',
					updatedAt: new Date().toISOString()
				}
			});
		}
	}
</script>

<button on:click={importImages} disabled={ingesting}>
	{ingesting ? 'Processing…' : 'Import Images'}
</button>

{#if ingesting}
	<div class="progress">
		Processing {ingestProgress}% ({ingestTotal} images)
		<progress max="100" value={ingestProgress}></progress>
	</div>
{/if}

<style>
	.progress {
		margin-top: 0.75rem;
		font-size: 0.8rem;
		color: #444;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	progress {
		width: 220px;
		height: 6px;
	}
</style>
