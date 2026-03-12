<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type GroupLike = {
		id: string;
		baseImageId: string;
		imageIds: string[];
		locked?: boolean;
		status?: 'draft' | 'locked';
	};

	type ImageLike = {
		id: string;
		name?: string;
		contentHash?: string;
		path?: string;
		leafFolderName?: string;
	};

	export let group: GroupLike;
	export let allImages: ImageLike[] = [];
	export let ungroupedImages: ImageLike[] = [];

	export let onAddImages: ((imageIds: string[]) => void) | undefined;
	export let onRemoveImage: ((imageId: string) => void) | undefined;
	export let onSetBaseImage: ((imageId: string) => void) | undefined;
	export let onReorder: ((orderedImageIds: string[]) => void) | undefined;

	let selectedAddIds: string[] = [];

	$: imageMap = new Map(allImages.map((img) => [img.id, img]));
	$: orderedImages = group.imageIds.map((id) => imageMap.get(id)).filter(Boolean) as ImageLike[];

	$: baseImage = imageMap.get(group.baseImageId) ?? null;
	$: status = group.status ?? (group.locked ? 'locked' : 'draft');
	$: availableAddImages = ungroupedImages.filter((img) => !group.imageIds.includes(img.id));

	function isBase(imageId: string) {
		return group.baseImageId === imageId;
	}

	function toggleAddSelection(imageId: string) {
		selectedAddIds = selectedAddIds.includes(imageId)
			? selectedAddIds.filter((id) => id !== imageId)
			: [...selectedAddIds, imageId];
	}

	function clearAddSelection() {
		selectedAddIds = [];
	}

	function addSelectedImages() {
		if (selectedAddIds.length === 0) return;
		onAddImages?.(selectedAddIds);
		selectedAddIds = [];
	}

	function moveImage(imageId: string, direction: -1 | 1) {
		const current = [...group.imageIds];
		const index = current.indexOf(imageId);
		if (index === -1) return;

		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= current.length) return;

		[current[index], current[targetIndex]] = [current[targetIndex], current[index]];
		onReorder?.(current);
	}

	function removeImage(imageId: string) {
		onRemoveImage?.(imageId);
	}

	function setBaseImage(imageId: string) {
		onSetBaseImage?.(imageId);
	}
</script>

<div class="group-editor">
	<div class="editor-scroll">
		<div class="base-panel">
			<div class="subheading-row">
				<div class="subheading">Base image</div>
				<div
					class:locked-pill={status === 'locked'}
					class:draft-pill={status !== 'locked'}
					class="status-pill"
				>
					{status === 'locked' ? 'Locked' : 'Draft'}
				</div>
			</div>

			{#if baseImage}
				<div class="base-preview">
					<div class="base-image-frame">
						{#if baseImage.contentHash}
							<CachedThumb
								contentHash={baseImage.contentHash}
								alt={baseImage.name ?? 'Base image'}
							/>
						{:else}
							<div class="fallback">No preview</div>
						{/if}
					</div>

					<div class="base-meta">
						<div class="base-name" title={baseImage.name ?? baseImage.id}>
							{baseImage.name ?? baseImage.id}
						</div>

						{#if baseImage.leafFolderName}
							<div class="base-detail">Leaf folder: {baseImage.leafFolderName}</div>
						{:else if baseImage.path}
							<div class="base-detail" title={baseImage.path}>{baseImage.path}</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="empty-box">This group does not currently have a valid base image.</div>
			{/if}
		</div>

		<div class="members-panel">
			<div class="subheading-row">
				<div class="subheading">Images in group</div>
				<div class="count-pill">
					{group.imageIds.length}
					{group.imageIds.length === 1 ? 'image' : 'images'}
				</div>
			</div>

			{#if orderedImages.length === 0}
				<div class="empty-box">This group is empty.</div>
			{:else}
				<div class="member-list">
					{#each orderedImages as image, index (image.id)}
						<div class:base-row={isBase(image.id)} class="member-row">
							<div class="member-thumb">
								{#if image.contentHash}
									<CachedThumb contentHash={image.contentHash} alt={image.name ?? 'Group image'} />
								{:else}
									<div class="thumb-fallback"></div>
								{/if}
							</div>

							<div class="member-main">
								<div class="member-title-row">
									<div class="member-title" title={image.name ?? image.id}>
										{image.name ?? image.id}
									</div>

									{#if isBase(image.id)}
										<div class="base-badge">Base</div>
									{/if}
								</div>

								<div class="member-meta">
									<div>Position {index + 1}</div>

									{#if image.leafFolderName}
										<div>{image.leafFolderName}</div>
									{/if}
								</div>

								<div class="member-actions">
									<button
										type="button"
										class="mini-btn"
										disabled={index === 0}
										on:click={() => moveImage(image.id, -1)}
									>
										Up
									</button>

									<button
										type="button"
										class="mini-btn"
										disabled={index === orderedImages.length - 1}
										on:click={() => moveImage(image.id, 1)}
									>
										Down
									</button>

									<button
										type="button"
										class="mini-btn"
										disabled={isBase(image.id)}
										on:click={() => setBaseImage(image.id)}
									>
										Set base
									</button>

									<button
										type="button"
										class="mini-btn danger"
										on:click={() => removeImage(image.id)}
									>
										Remove
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="add-panel">
			<div class="subheading-row">
				<div class="subheading">Add from unassigned</div>
				{#if selectedAddIds.length > 0}
					<div class="count-pill">{selectedAddIds.length} selected</div>
				{/if}
			</div>

			{#if availableAddImages.length === 0}
				<div class="empty-box">No unassigned images available.</div>
			{:else}
				<div class="add-grid">
					{#each availableAddImages as image (image.id)}
						<button
							type="button"
							class:selected-add={selectedAddIds.includes(image.id)}
							class="add-tile"
							on:click={() => toggleAddSelection(image.id)}
							title={image.name ?? image.id}
						>
							<div class="add-thumb">
								{#if image.contentHash}
									<CachedThumb
										contentHash={image.contentHash}
										alt={image.name ?? 'Ungrouped image'}
									/>
								{:else}
									<div class="thumb-fallback"></div>
								{/if}
							</div>

							<div class="add-name">{image.name ?? image.id}</div>
						</button>
					{/each}
				</div>

				<div class="add-actions">
					<button
						type="button"
						class="secondary-btn"
						disabled={selectedAddIds.length === 0}
						on:click={clearAddSelection}
					>
						Clear
					</button>

					<button
						type="button"
						class="primary-btn"
						disabled={selectedAddIds.length === 0}
						on:click={addSelectedImages}
					>
						Add selected
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.group-editor {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.editor-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.base-panel,
	.members-panel,
	.add-panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.9rem;
		padding: 0.85rem;
	}

	.subheading-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.75rem;
	}

	.subheading {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #6b7280;
	}

	.status-pill,
	.count-pill,
	.base-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.18rem 0.55rem;
		font-size: 0.74rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.count-pill {
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		color: #4b5563;
	}

	.draft-pill {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		color: #374151;
	}

	.locked-pill {
		background: #dcfce7;
		border: 1px solid #bbf7d0;
		color: #166534;
	}

	.base-badge {
		background: #dbeafe;
		border: 1px solid #bfdbfe;
		color: #1d4ed8;
	}

	.base-preview {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.base-image-frame {
		aspect-ratio: 4 / 3;
		border-radius: 0.8rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
	}

	.base-image-frame :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #f9fafb;
	}

	.base-meta {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.base-name {
		font-size: 0.98rem;
		font-weight: 600;
		color: #111827;
		line-height: 1.3;
		word-break: break-word;
	}

	.base-detail {
		font-size: 0.83rem;
		color: #6b7280;
		word-break: break-word;
	}

	.member-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.member-row {
		display: grid;
		grid-template-columns: 68px minmax(0, 1fr);
		gap: 0.75rem;
		padding: 0.65rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		background: #fff;
	}

	.member-row.base-row {
		border-color: #bfdbfe;
		background: #f8fbff;
	}

	.member-thumb {
		width: 68px;
		height: 68px;
		border-radius: 0.6rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		background: #f3f4f6;
	}

	.member-thumb :global(img),
	.add-thumb :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.member-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.member-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.member-title {
		font-weight: 600;
		color: #111827;
		line-height: 1.25;
		word-break: break-word;
	}

	.member-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.9rem;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.member-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.mini-btn,
	.secondary-btn,
	.primary-btn {
		border-radius: 0.55rem;
		padding: 0.42rem 0.7rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.mini-btn,
	.secondary-btn {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #374151;
	}

	.mini-btn:hover:not(:disabled),
	.secondary-btn:hover:not(:disabled) {
		background: #f9fafb;
	}

	.primary-btn {
		border: 1px solid #2563eb;
		background: #2563eb;
		color: white;
	}

	.primary-btn:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}

	.mini-btn.danger {
		border-color: #fecaca;
		color: #b91c1c;
		background: #fff;
	}

	.mini-btn.danger:hover:not(:disabled) {
		background: #fef2f2;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.add-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 0.65rem;
	}

	.add-tile {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.45rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		background: #fff;
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}

	.add-tile:hover {
		background: #f9fafb;
		border-color: #cfd8e3;
	}

	.add-tile.selected-add {
		border-color: #60a5fa;
		background: #eff6ff;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
	}

	.add-thumb {
		aspect-ratio: 1 / 1;
		border-radius: 0.55rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		background: #f3f4f6;
	}

	.add-name {
		font-size: 0.76rem;
		color: #374151;
		line-height: 1.25;
		word-break: break-word;
	}

	.add-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.55rem;
		margin-top: 0.75rem;
	}

	.empty-box,
	.fallback,
	.thumb-fallback {
		display: grid;
		place-items: center;
		color: #6b7280;
	}

	.empty-box {
		border: 1px dashed #d1d5db;
		border-radius: 0.75rem;
		padding: 0.85rem;
		background: #fafafa;
		font-size: 0.9rem;
	}

	.fallback,
	.thumb-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		font-size: 0.82rem;
	}
</style>
