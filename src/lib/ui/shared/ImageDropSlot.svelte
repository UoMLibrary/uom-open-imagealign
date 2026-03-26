<script lang="ts">
	import { onDestroy } from 'svelte';

	type ImageInfo = {
		width: number;
		height: number;
		size: number;
		type: string;
		name: string;
	};

	type Props = {
		label: string;
		imageUrl?: string | null;
		info?: ImageInfo | null;
		active?: boolean;
		disabled?: boolean;
		accept?: string;
		placeholderTitle?: string;
		placeholderSubtitle?: string;
		previewSize?: number;
		onFileSelected?: (file: File | null) => void | Promise<void>;
		onClear?: () => void | Promise<void>;
	};

	let {
		label,
		imageUrl = null,
		info = null,
		active = false,
		disabled = false,
		accept = 'image/*',
		placeholderTitle = 'Click to load',
		placeholderSubtitle = 'or drag and drop',
		previewSize = 256,
		onFileSelected,
		onClear
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let isDragging = $state(false);

	let previewUrl = $state<string | null>(null);
	let previewBusy = $state(false);

	let previewRunId = 0;

	// non-reactive handle to the currently owned generated preview URL
	let ownedPreviewUrl: string | null = null;

	function openPicker() {
		if (disabled) return;
		inputEl?.click();
	}

	async function handleInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		await onFileSelected?.(file);
	}

	function handleDragOver(event: DragEvent) {
		if (disabled) return;
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		if (disabled) return;
		event.preventDefault();
		isDragging = false;
	}

	async function handleDrop(event: DragEvent) {
		if (disabled) return;
		event.preventDefault();
		isDragging = false;

		const file = event.dataTransfer?.files?.[0] ?? null;
		await onFileSelected?.(file);
	}

	async function clear(event: MouseEvent) {
		event.stopPropagation();
		if (inputEl) inputEl.value = '';
		await onClear?.();
	}

	function releaseOwnedPreview() {
		if (ownedPreviewUrl) {
			URL.revokeObjectURL(ownedPreviewUrl);
			ownedPreviewUrl = null;
		}
	}

	function setPreview(next: string | null) {
		if (ownedPreviewUrl && ownedPreviewUrl !== next) {
			URL.revokeObjectURL(ownedPreviewUrl);
		}
		ownedPreviewUrl = next;
		previewUrl = next;
	}

	async function createSquarePreview(url: string, size: number): Promise<string> {
		const img = new Image();
		img.decoding = 'async';

		const loaded = new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('Failed to load image for preview'));
		});

		img.src = url;
		await loaded;

		const sourceWidth = img.naturalWidth;
		const sourceHeight = img.naturalHeight;
		const side = Math.min(sourceWidth, sourceHeight);

		const sx = Math.round((sourceWidth - side) / 2);
		const sy = Math.round((sourceHeight - side) / 2);

		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;

		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not create canvas context');

		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

		const outBlob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(result) => {
					if (result) resolve(result);
					else reject(new Error('Could not create preview blob'));
				},
				'image/jpeg',
				0.86
			);
		});

		return URL.createObjectURL(outBlob);
	}

	$effect(() => {
		const url = imageUrl;
		const size = previewSize;
		const runId = ++previewRunId;

		if (!url) {
			previewBusy = false;
			setPreview(null);
			return;
		}

		previewBusy = true;

		(async () => {
			try {
				const nextPreviewUrl = await createSquarePreview(url, size);

				if (runId !== previewRunId) {
					URL.revokeObjectURL(nextPreviewUrl);
					return;
				}

				setPreview(nextPreviewUrl);
			} catch (err) {
				console.error('Preview generation failed', err);

				if (runId !== previewRunId) return;
				setPreview(null);
			} finally {
				if (runId === previewRunId) {
					previewBusy = false;
				}
			}
		})();

		return () => {
			previewRunId++;
		};
	});

	onDestroy(() => {
		releaseOwnedPreview();
	});

	const displayUrl = $derived(previewUrl ?? imageUrl);
</script>

<div class="source-card">
	<input class="sr-only" bind:this={inputEl} type="file" {accept} onchange={handleInputChange} />

	<div class="slot-wrap">
		<button
			type="button"
			class="drop-slot"
			class:filled={!!imageUrl}
			class:active={active || isDragging}
			{disabled}
			aria-label={imageUrl ? `Replace ${label}` : `Load ${label}`}
			onclick={openPicker}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			{#if imageUrl}
				<img src={displayUrl ?? imageUrl} alt={`${label} preview`} class="slot-image" />

				<div class="image-overlay">
					<div class="overlay-pill">{label}</div>

					<div class="overlay-copy">
						{#if isDragging}
							<div class="overlay-title">Drop image</div>
							<div class="overlay-line">Release to replace</div>
						{:else}
							<div class="overlay-title" title={info?.name}>{info?.name ?? 'Selected image'}</div>

							{#if info}
								<div class="overlay-line">{info.width} × {info.height}</div>
								<div class="overlay-line">{info.type || 'image'}</div>
							{/if}
						{/if}
					</div>
				</div>

				{#if previewBusy}
					<div class="preview-badge">Preparing preview…</div>
				{/if}
			{:else}
				<div class="slot-empty">
					<div class="overlay-pill empty-pill">{label}</div>

					<div class="slot-plus">+</div>

					<div class="slot-copy">
						<div class="slot-title">{isDragging ? 'Drop image' : placeholderTitle}</div>
						<div class="slot-subtitle">
							{isDragging ? 'Release to load' : placeholderSubtitle}
						</div>
					</div>
				</div>
			{/if}
		</button>

		{#if imageUrl}
			<button
				type="button"
				class="clear-button"
				onclick={clear}
				aria-label={`Clear ${label.toLowerCase()}`}
				title="Clear image"
			>
				×
			</button>
		{/if}
	</div>
</div>

<style>
	.source-card {
		width: 148px;
		flex: 0 0 auto;
	}

	.slot-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.drop-slot {
		width: 100%;
		height: 100%;
		border: 1.5px dashed #cbd5e1;
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
		padding: 0;
		overflow: hidden;
		position: relative;
		cursor: pointer;
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			background 0.18s ease;
	}

	.drop-slot:hover:not(:disabled),
	.drop-slot:focus-visible:not(:disabled) {
		transform: translateY(-1px);
		border-color: #94a3b8;
		box-shadow: 0 12px 20px rgba(15, 23, 42, 0.07);
	}

	.drop-slot.active {
		border-color: #2563eb;
		background: rgba(239, 246, 255, 0.96);
		box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
	}

	.drop-slot.filled {
		border-style: solid;
		border-color: rgba(148, 163, 184, 0.45);
	}

	.drop-slot:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.slot-image {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		transition:
			transform 0.22s ease,
			filter 0.22s ease,
			opacity 0.22s ease;
	}

	.image-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 0.65rem;
		background: linear-gradient(
			180deg,
			rgba(15, 23, 42, 0.2) 0%,
			rgba(15, 23, 42, 0.08) 25%,
			rgba(15, 23, 42, 0.68) 100%
		);
		backdrop-filter: blur(0px);
		opacity: 0;
		transition:
			opacity 0.22s ease,
			backdrop-filter 0.22s ease;
		pointer-events: none;
	}

	.drop-slot:hover .image-overlay,
	.drop-slot:focus-visible .image-overlay,
	.drop-slot.active .image-overlay {
		opacity: 1;
		backdrop-filter: blur(2px);
	}

	.drop-slot:hover .slot-image,
	.drop-slot:focus-visible .slot-image,
	.drop-slot.active .slot-image {
		transform: scale(1.03);
		filter: brightness(0.55) blur(2px);
	}

	.overlay-pill,
	.empty-pill {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.overlay-pill {
		background: rgba(255, 255, 255, 0.9);
		color: #0f172a;
	}

	.empty-pill {
		position: absolute;
		top: 0.65rem;
		left: 0.65rem;
		background: #eef2ff;
		color: #334155;
	}

	.overlay-copy {
		color: white;
		text-align: left;
		min-width: 0;
	}

	.overlay-title {
		font-size: 0.84rem;
		font-weight: 700;
		line-height: 1.3;
		word-break: break-word;
		line-clamp: 2;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.overlay-line {
		margin-top: 0.18rem;
		font-size: 0.76rem;
		line-height: 1.35;
		color: rgba(255, 255, 255, 0.88);
		word-break: break-word;
	}

	.preview-badge {
		position: absolute;
		left: 0.55rem;
		bottom: 0.55rem;
		z-index: 3;
		padding: 0.28rem 0.5rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.92);
		color: #334155;
		box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
		pointer-events: none;
	}

	.slot-empty {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		text-align: center;
		padding: 0.9rem;
		box-sizing: border-box;
		color: #64748b;
		position: relative;
	}

	.slot-plus {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: #eff6ff;
		color: #2563eb;
		font-size: 1.35rem;
		font-weight: 600;
		margin: 0 auto 0.65rem;
	}

	.slot-copy {
		font-size: 0.84rem;
		line-height: 1.35;
	}

	.slot-title {
		font-weight: 700;
		color: #334155;
	}

	.slot-subtitle {
		margin-top: 0.12rem;
		color: #64748b;
	}

	.clear-button {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		z-index: 3;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.65);
		background: rgba(255, 255, 255, 0.92);
		color: #0f172a;
		font: inherit;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
		opacity: 0;
		transform: translateY(-4px);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			background 0.18s ease;
	}

	.slot-wrap:hover .clear-button,
	.slot-wrap:focus-within .clear-button {
		opacity: 1;
		transform: translateY(0);
	}

	.clear-button:hover {
		background: white;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 640px) {
		.source-card {
			width: 100%;
		}
	}
</style>
