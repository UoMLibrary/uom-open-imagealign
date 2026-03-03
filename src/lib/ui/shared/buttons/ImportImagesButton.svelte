<script lang="ts">
	import { hashImageFile } from '$lib/image/hashing';
	import { addImage } from '$lib/core/projectStore';
	import { getDerivedBlob } from '$lib/image/derivationService';
	import { supportsFileSystemAccess } from '$lib/infrastructure/fileSystem';

	let ingesting = false;
	let ingestProgress = 0;
	let ingestTotal = 0;

	async function importImages() {
		const filesToProcess: { file: File; structuralPath?: string }[] = [];

		if (supportsFileSystemAccess()) {
			const dir = await (window as any).showDirectoryPicker();
			await collectFromDirectory(dir, filesToProcess);
			await processFiles(filesToProcess);
			return;
		}

		const input = document.createElement('input');
		input.type = 'file';
		(input as any).webkitdirectory = true;
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
				continue;
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

		const queue = [...items];
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

		await worker();
		ingesting = false;
	}

	async function ingestFile(file: File, structuralPath?: string) {
		if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
			console.warn('Unsupported image type:', file.name);
			return;
		}

		// 1) hash (dedupe cache by content, but we still add a new image ID per file)
		const { contentHash } = await hashImageFile(file);

		console.log('INGEST HASH:', contentHash);

		// 2) dimensions
		const bitmap = await createImageBitmap(file);
		const width = bitmap.width;
		const height = bitmap.height;
		bitmap.close?.();

		// 3) ensure cached artefacts exist (size+version are in the derivation service key)
		// Always provide file so a cache miss can build 'work'.
		await getDerivedBlob(contentHash, 'work', file);
		await getDerivedBlob(contentHash, 'thumb', file);

		// 4) runtime URI for UI (not part of persisted schema; store can strip on save)
		const objectUrl = URL.createObjectURL(file);

		// 5) add image record (simplified shape)
		addImage({
			id: crypto.randomUUID(),
			contentHash,
			label: file.name,
			structuralPath,
			dimensions: { width, height },
			runtimeUri: objectUrl
		});
	}
</script>

<!-- 🔘 BUTTON -->
<button on:click={importImages} disabled={ingesting}>
	{ingesting ? 'Processing…' : 'Import Images'}
</button>

<!-- 📊 PROGRESS -->
{#if ingesting}
	<div class="progress">
		Processing {ingestProgress}% ({ingestTotal} images)
		<progress max="100" value={ingestProgress}></progress>
	</div>
{/if}

<style>
	button {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

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
