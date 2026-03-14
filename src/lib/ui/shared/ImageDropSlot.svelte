<script lang="ts">
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
		onFileSelected,
		onClear
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let isDragging = $state(false);

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
</script>

<div class="source-card">
	<div class="source-head">
		<div class="source-label">{label}</div>

		{#if imageUrl}
			<button
				type="button"
				class="icon-button"
				on:click={clear}
				aria-label={`Clear ${label.toLowerCase()}`}
				title="Clear image"
			>
				×
			</button>
		{/if}
	</div>

	<input class="sr-only" bind:this={inputEl} type="file" {accept} on:change={handleInputChange} />

	<button
		type="button"
		class="drop-slot"
		class:filled={!!imageUrl}
		class:active={active || isDragging}
		{disabled}
		on:click={openPicker}
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
	>
		{#if imageUrl}
			<img src={imageUrl} alt={`${label} preview`} class="slot-image" />
		{:else}
			<div class="slot-empty">
				<div class="slot-plus">+</div>
				<div class="slot-copy">
					<div>{placeholderTitle}</div>
					<div>{placeholderSubtitle}</div>
				</div>
			</div>
		{/if}
	</button>

	<div class="source-meta">
		{#if info}
			<div class="source-name" title={info.name}>{info.name}</div>
			<div class="source-stats">
				<span>{info.width} × {info.height}</span>
				<span>{info.type || 'image'}</span>
			</div>
		{:else}
			<div class="source-placeholder">No image selected</div>
		{/if}
	</div>
</div>

<style>
	.source-card {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.source-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.source-label {
		font-size: 0.9rem;
		font-weight: 700;
		color: #334155;
	}

	.drop-slot {
		width: 148px;
		height: 148px;
		border: 1.5px dashed #cbd5e1;
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
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

	.drop-slot:hover:not(:disabled) {
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

	.source-meta {
		width: 148px;
		min-height: 2.6rem;
		display: grid;
		gap: 0.15rem;
	}

	.source-name {
		font-size: 0.84rem;
		font-weight: 600;
		color: #0f172a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.source-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: #64748b;
	}

	.source-placeholder {
		font-size: 0.82rem;
		color: #94a3b8;
	}

	.icon-button {
		width: 1.8rem;
		height: 1.8rem;
		padding: 0;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid #dbe1e8;
		background: white;
		color: #0f172a;
		font: inherit;
		cursor: pointer;
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
		.drop-slot,
		.source-meta {
			width: 100%;
		}

		.drop-slot {
			height: auto;
			aspect-ratio: 1 / 1;
		}
	}
</style>
