<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	type ImageLike = {
		id: string;
		name?: string;
		contentHash?: string;
		path?: string;
		leafFolderName?: string;
	};

	export let images: ImageLike[] = [];
	export let selectedIds: string[] = [];
	export let selectedGroupId: string | null = null;

	export let onSelectionChange: ((ids: string[]) => void) | undefined;
	export let onCreateSingleGroup: ((imageId: string) => void) | undefined;
	export let onCreateGroupFromSelection: (() => void) | undefined;
	export let onAddSelectionToGroup: (() => void) | undefined;

	let filterText = '';
	let lastSelectedId: string | null = null;

	$: normalisedFilter = filterText.trim().toLowerCase();

	function matchesFilter(image: ImageLike) {
		if (!normalisedFilter) return true;

		const haystack = [image.name, image.path, image.leafFolderName, image.id]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return haystack.includes(normalisedFilter);
	}

	$: filteredImages = images.filter(matchesFilter);

	function setSelection(ids: string[]) {
		onSelectionChange?.(ids);
	}

	function clearSelection() {
		setSelection([]);
		lastSelectedId = null;
	}

	function selectAllVisible() {
		setSelection(filteredImages.map((img) => img.id));
	}

	function toggleSingle(imageId: string) {
		setSelection(
			selectedIds.includes(imageId)
				? selectedIds.filter((id) => id !== imageId)
				: [...selectedIds, imageId]
		);
		lastSelectedId = imageId;
	}

	function selectRange(imageId: string) {
		if (!lastSelectedId) {
			setSelection([imageId]);
			lastSelectedId = imageId;
			return;
		}

		const start = filteredImages.findIndex((img) => img.id === lastSelectedId);
		const end = filteredImages.findIndex((img) => img.id === imageId);

		if (start === -1 || end === -1) {
			setSelection([imageId]);
			lastSelectedId = imageId;
			return;
		}

		const [from, to] = start < end ? [start, end] : [end, start];
		const rangeIds = filteredImages.slice(from, to + 1).map((img) => img.id);
		const merged = Array.from(new Set([...selectedIds, ...rangeIds]));

		setSelection(merged);
		lastSelectedId = imageId;
	}

	function handleTileClick(event: MouseEvent, imageId: string) {
		if (event.shiftKey) {
			selectRange(imageId);
			return;
		}

		if (event.metaKey || event.ctrlKey) {
			toggleSingle(imageId);
			return;
		}

		setSelection([imageId]);
		lastSelectedId = imageId;
	}

	function handleTileKeydown(event: KeyboardEvent, imageId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleTileClick(new MouseEvent('click'), imageId);
			return;
		}

		if ((event.key === 'g' || event.key === 'G') && selectedIds.length > 0) {
			event.preventDefault();
			onCreateGroupFromSelection?.();
		}
	}

	function handleDragStart(event: DragEvent, imageId: string) {
		const dragIds = selectedIds.includes(imageId) ? selectedIds : [imageId];

		if (!selectedIds.includes(imageId)) {
			setSelection(dragIds);
			lastSelectedId = imageId;
		}

		event.dataTransfer?.setData('text/plain', JSON.stringify(dragIds));
		event.dataTransfer?.setData('application/x-image-ids', JSON.stringify(dragIds));
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function createSingle(imageId: string) {
		onCreateSingleGroup?.(imageId);
	}

	function createFromSelection() {
		if (selectedIds.length === 0) return;
		onCreateGroupFromSelection?.();
	}

	function addSelectionToGroup() {
		if (selectedIds.length === 0 || !selectedGroupId) return;
		onAddSelectionToGroup?.();
	}
</script>

<div class="ungrouped-pool">
	<div class="toolbar">
		<div class="search-wrap">
			<input
				class="search-input"
				type="search"
				placeholder="Filter unassigned images"
				bind:value={filterText}
			/>
		</div>

		<div class="toolbar-meta">
			<div class="count-pill">{filteredImages.length} shown</div>
			{#if selectedIds.length > 0}
				<div class="count-pill selected">{selectedIds.length} selected</div>
			{/if}
		</div>
	</div>

	<div class="actions">
		<button
			type="button"
			class="mini-btn"
			on:click={selectAllVisible}
			disabled={filteredImages.length === 0}
		>
			Select all
		</button>

		<button
			type="button"
			class="mini-btn"
			on:click={clearSelection}
			disabled={selectedIds.length === 0}
		>
			Clear
		</button>

		<button
			type="button"
			class="primary-btn"
			on:click={createFromSelection}
			disabled={selectedIds.length === 0}
		>
			Create group
		</button>

		<button
			type="button"
			class="mini-btn"
			on:click={addSelectionToGroup}
			disabled={selectedIds.length === 0 || !selectedGroupId}
			title={!selectedGroupId ? 'Select a group first' : 'Add selected images to current group'}
		>
			Add to selected group
		</button>
	</div>

	<div class="helper-text">
		Click to select. Ctrl/Cmd-click toggles. Shift-click selects a range. Drag selected images onto
		a group card to add them.
	</div>

	{#if filteredImages.length === 0}
		<div class="empty-state">
			<div class="empty-title">
				{images.length === 0 ? 'No unassigned images' : 'No matches'}
			</div>
			<div class="empty-copy">
				{#if images.length === 0}
					All images are already in groups, or none have been loaded yet.
				{:else}
					Try a different filter.
				{/if}
			</div>
		</div>
	{:else}
		<div class="image-grid">
			{#each filteredImages as image (image.id)}
				{@const isSelected = selectedIds.includes(image.id)}

				<div
					class:selected={isSelected}
					class="image-tile"
					role="button"
					tabindex="0"
					draggable="true"
					aria-pressed={isSelected}
					aria-label={image.name ?? image.id}
					on:click={(event) => handleTileClick(event, image.id)}
					on:keydown={(event) => handleTileKeydown(event, image.id)}
					on:dragstart={(event) => handleDragStart(event, image.id)}
				>
					<div class="thumb-wrap">
						<div class="thumb-frame">
							{#if image.contentHash}
								<CachedThumb contentHash={image.contentHash} alt={image.name ?? 'Image'} />
							{:else}
								<div class="thumb-fallback">No preview</div>
							{/if}
						</div>

						{#if isSelected}
							<div class="selected-badge">Selected</div>
						{/if}
					</div>

					<div class="tile-body">
						<div class="tile-title" title={image.name ?? image.id}>
							{image.name ?? image.id}
						</div>

						{#if image.leafFolderName}
							<div class="tile-meta">{image.leafFolderName}</div>
						{:else if image.path}
							<div class="tile-meta" title={image.path}>{image.path}</div>
						{/if}
					</div>

					<div class="tile-actions">
						<button
							type="button"
							class="mini-btn"
							on:click|stopPropagation={() => createSingle(image.id)}
						>
							Single group
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.ungrouped-pool {
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: #fff;
	}

	.toolbar {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.search-wrap {
		display: flex;
	}

	.search-input {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 0.65rem;
		padding: 0.6rem 0.75rem;
		font-size: 0.9rem;
		background: #fff;
		color: #111827;
	}

	.search-input:focus {
		outline: none;
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
	}

	.toolbar-meta,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.actions {
		padding: 0.75rem;
		padding-top: 0.65rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.helper-text {
		padding: 0.65rem 0.75rem;
		font-size: 0.78rem;
		line-height: 1.4;
		color: #6b7280;
		border-bottom: 1px solid #e5e7eb;
		background: #fafafa;
	}

	.count-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.18rem 0.55rem;
		font-size: 0.74rem;
		font-weight: 700;
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		color: #4b5563;
	}

	.count-pill.selected {
		background: #eff6ff;
		border-color: #bfdbfe;
		color: #1d4ed8;
	}

	.image-grid {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.75rem;
		align-content: start;
	}

	.image-tile {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.8rem;
		background: #fff;
		cursor: pointer;
		outline: none;
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease,
			transform 120ms ease,
			background 120ms ease;
	}

	.image-tile:hover {
		border-color: #cfd8e3;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
		transform: translateY(-1px);
	}

	.image-tile:focus-visible {
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
	}

	.image-tile.selected {
		border-color: #60a5fa;
		background: #f8fbff;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
	}

	.thumb-wrap {
		position: relative;
	}

	.thumb-frame {
		aspect-ratio: 1 / 1;
		border-radius: 0.65rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
	}

	.thumb-frame :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: #6b7280;
		font-size: 0.78rem;
	}

	.selected-badge {
		position: absolute;
		top: 0.45rem;
		right: 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.4rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 700;
		background: rgba(37, 99, 235, 0.92);
		color: white;
		backdrop-filter: blur(8px);
	}

	.tile-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.tile-title {
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1.25;
		color: #111827;
		word-break: break-word;
	}

	.tile-meta {
		font-size: 0.74rem;
		line-height: 1.25;
		color: #6b7280;
		word-break: break-word;
	}

	.tile-actions {
		display: flex;
		justify-content: flex-end;
	}

	.mini-btn,
	.primary-btn {
		border-radius: 0.55rem;
		padding: 0.42rem 0.7rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.mini-btn {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #374151;
	}

	.mini-btn:hover:not(:disabled) {
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

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.empty-state {
		margin: 0.75rem;
		border: 1px dashed #d1d5db;
		border-radius: 0.9rem;
		padding: 1rem;
		background: #fafafa;
		color: #6b7280;
	}

	.empty-title {
		font-weight: 600;
		color: #374151;
		margin-bottom: 0.35rem;
	}

	.empty-copy {
		font-size: 0.9rem;
		line-height: 1.45;
	}
</style>
