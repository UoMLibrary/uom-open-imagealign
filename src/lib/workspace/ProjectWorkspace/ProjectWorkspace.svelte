<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import { projectState } from '$lib/core/projectStore.svelte';

	let leftPanelOpen = $state(true);
	let selectedGroupId = $state<string | null>(null);
	let selectedImageId = $state<string | null>(null);

	let project = $derived(projectState.project);
	let groups = $derived(project?.groups ?? []);
	let images = $derived(project?.images ?? []);
	let alignments = $derived(project?.alignments ?? []);
	let annotations = $derived(project?.annotations ?? []);

	let imageById = $derived.by(() => {
		const map = new Map<string, (typeof images)[number]>();

		for (const image of images) {
			map.set(image.id, image);
		}

		return map;
	});

	let groupStats = $derived.by(() => {
		const map = new Map<
			string,
			{
				alignmentCount: number;
				annotationCount: number;
			}
		>();

		for (const group of groups) {
			map.set(group.id, {
				alignmentCount: alignments.filter((a) => a.groupId === group.id).length,
				annotationCount: annotations.filter((a) => a.groupId === group.id).length
			});
		}

		return map;
	});

	let selectedGroup = $derived(groups.find((group) => group.id === selectedGroupId) ?? null);

	let selectedGroupImages = $derived.by(() => {
		if (!selectedGroup) return [];

		return selectedGroup.imageIds
			.map((imageId) => imageById.get(imageId))
			.filter(Boolean) as (typeof images)[number][];
	});

	let selectedGroupAlignments = $derived.by(() => {
		if (!selectedGroup) return [];
		return alignments.filter((alignment) => alignment.groupId === selectedGroup.id);
	});

	let selectedGroupAnnotations = $derived.by(() => {
		if (!selectedGroup) return [];
		return annotations.filter((annotation) => annotation.groupId === selectedGroup.id);
	});

	let selectedImage = $derived(
		selectedImageId
			? (selectedGroupImages.find((image) => image.id === selectedImageId) ?? null)
			: null
	);

	let alignmentByComparedId = $derived.by(() => {
		const map = new Map<string, (typeof alignments)[number]>();

		for (const alignment of selectedGroupAlignments) {
			map.set(alignment.comparedImageId, alignment);
		}

		return map;
	});

	let selectedImageAlignment = $derived(
		selectedImage && selectedGroup && selectedImage.id !== selectedGroup.baseImageId
			? (alignmentByComparedId.get(selectedImage.id) ?? null)
			: null
	);

	$effect(() => {
		if (!project) {
			selectedGroupId = null;
			selectedImageId = null;
			return;
		}

		if (!selectedGroupId || !groups.some((group) => group.id === selectedGroupId)) {
			selectedGroupId = groups[0]?.id ?? null;
		}
	});

	$effect(() => {
		if (!selectedGroup) {
			selectedImageId = null;
			return;
		}

		if (!selectedImageId || !selectedGroup.imageIds.includes(selectedImageId)) {
			selectedImageId = selectedGroup.baseImageId ?? selectedGroup.imageIds[0] ?? null;
		}
	});

	function selectGroup(groupId: string) {
		selectedGroupId = groupId;
	}

	function selectImage(imageId: string) {
		selectedImageId = imageId;
	}

	function getGroupLabel(group: (typeof groups)[number]): string {
		return group.label?.trim?.() || group.id;
	}

	function getImageTitle(image: (typeof images)[number]): string {
		const title = image?.metadata?.title;
		if (typeof title === 'string' && title.trim()) return title;
		if (typeof image?.label === 'string' && image.label.trim()) return image.label;
		return image?.id ?? 'Untitled image';
	}

	function getImageSourceKind(image: (typeof images)[number]): string {
		const kind = image?.source?.kind;
		if (kind === 'iiif') return 'IIIF';
		if (kind === 'url') return 'URL';
		if (kind === 'local') return 'Local';
		return 'Unknown';
	}

	function getImageSourceValue(image: (typeof images)[number]): string {
		const source = image?.source;
		if (!source) return '';

		if (source.kind === 'local') return source.imageRef ?? '';
		if (source.kind === 'url') return source.url ?? '';
		if (source.kind === 'iiif') return source.url ?? '';

		return '';
	}

	function getMetadataEntries(metadata: Record<string, unknown> | null | undefined) {
		if (!metadata) return [];
		return Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b));
	}

	function formatValue(value: unknown): string {
		if (value === null) return 'null';
		if (value === undefined) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		return JSON.stringify(value);
	}

	function formatCreated(value: string | undefined): string {
		if (!value) return '—';

		try {
			return new Intl.DateTimeFormat('en-GB', {
				year: 'numeric',
				month: 'short',
				day: '2-digit'
			}).format(new Date(value));
		} catch {
			return value;
		}
	}

	function geometrySummary(geometry: unknown): string {
		if (!geometry || typeof geometry !== 'object') return '—';

		const g = geometry as {
			type?: string;
			value?: {
				x?: number;
				y?: number;
				w?: number;
				h?: number;
				points?: Array<{ x: number; y: number }>;
			};
		};

		if (g.type === 'rect' && g.value) {
			return `rect ${roundish(g.value.x)}, ${roundish(g.value.y)}, ${roundish(g.value.w)}, ${roundish(g.value.h)}`;
		}

		if (g.type === 'point' && g.value) {
			return `point ${roundish(g.value.x)}, ${roundish(g.value.y)}`;
		}

		if ((g.type === 'polygon' || g.type === 'line') && g.value?.points) {
			return `${g.type} (${g.value.points.length} points)`;
		}

		return g.type ?? 'geometry';
	}

	function roundish(value: unknown): string {
		if (typeof value !== 'number') return '—';
		return value.toFixed(3).replace(/\.?0+$/, '');
	}

	function pretty(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

{#if !project}
	<div class="empty-state">
		<h2>No project loaded</h2>
		<p>
			Open a project, create one from a folder, or import from a spreadsheet to see the project
			here.
		</p>
	</div>
{:else}
	<div class="workspace">
		<SidePanel side="left" bind:open={leftPanelOpen}>
			<div class="sidebar-shell">
				<div class="sidebar-header">
					<div class="project-line">
						<div class="project-name">{project.title || 'Untitled project'}</div>
						<div class="project-created">Created: {formatCreated(project.createdAt)}</div>
					</div>
				</div>

				<div class="sidebar-scroll">
					{#if groups.length === 0}
						<div class="empty">No groups yet</div>
					{:else}
						<div class="group-list">
							{#each groups as group, idx (`${group.id}:${idx}`)}
								{@const baseImage = imageById.get(group.baseImageId)}
								{@const stats = groupStats.get(group.id)}

								<button
									type="button"
									class="group-card"
									class:selected={group.id === selectedGroupId}
									onclick={() => selectGroup(group.id)}
								>
									<div class="group-thumb">
										{#if baseImage}
											<CachedThumb contentHash={baseImage.contentHash} alt={getGroupLabel(group)} />
										{:else}
											<div class="thumb-fallback">No base</div>
										{/if}
									</div>

									<div class="group-copy">
										<div class="group-title-row">
											<div class="group-title">{getGroupLabel(group)}</div>
											<div class="group-count">{group.imageIds.length} images</div>
										</div>

										<div class="group-subline">
											<span>{stats?.alignmentCount ?? 0} alignments</span>
											<span>{stats?.annotationCount ?? 0} annotations</span>
										</div>

										<div class="group-id">{group.id}</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="sidebar-footer">
					{images.length} images {groups.length} groups {alignments.length} alignments {annotations.length}
					annotations
				</div>
			</div>
		</SidePanel>

		<main class="main">
			{#if selectedGroup}
				<section class="group-header-card">
					<div class="group-header-main">
						<h2>{getGroupLabel(selectedGroup)}</h2>
						<div class="group-header-sub">
							Group ID: <code>{selectedGroup.id}</code>
						</div>
					</div>

					<div class="group-header-stats">
						<span class="pill">{selectedGroup.imageIds.length} images</span>
						<span class="pill">{selectedGroupAlignments.length} alignments</span>
						<span class="pill">{selectedGroupAnnotations.length} annotations</span>
					</div>
				</section>

				<section class="image-grid">
					{#each selectedGroupImages as image (image.id)}
						{@const alignment = alignmentByComparedId.get(image.id)}

						<button
							type="button"
							class="image-card"
							class:selected={image.id === selectedImageId}
							class:base={image.id === selectedGroup.baseImageId}
							onclick={() => selectImage(image.id)}
						>
							<div class="image-thumb">
								<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
							</div>

							<div class="image-copy">
								<div class="image-title-row">
									<div class="image-title">{getImageTitle(image)}</div>

									{#if image.id === selectedGroup.baseImageId}
										<span class="badge base">Base</span>
									{:else if alignment}
										<span class="badge ok">{alignment.status}</span>
									{:else}
										<span class="badge muted">Unaligned</span>
									{/if}
								</div>

								<div class="image-subline">
									{getImageSourceKind(image)} · {image.dimensions.width} × {image.dimensions.height}
								</div>

								<div class="image-path">{getImageSourceValue(image)}</div>

								<div class="image-hash">hash: {image.contentHash}</div>
							</div>
						</button>
					{/each}
				</section>

				{#if selectedImage}
					<section class="detail-card">
						<div class="detail-head">
							<h3>Selected image</h3>

							{#if selectedImage.id === selectedGroup.baseImageId}
								<span class="pill">Base image</span>
							{:else if selectedImageAlignment}
								<span class="pill ok">{selectedImageAlignment.status}</span>
							{/if}
						</div>

						<div class="detail-layout">
							<div class="detail-thumb">
								<CachedThumb
									contentHash={selectedImage.contentHash}
									alt={getImageTitle(selectedImage)}
								/>
							</div>

							<div class="detail-copy">
								<div class="detail-title">{getImageTitle(selectedImage)}</div>

								<div class="kv-grid">
									<div class="kv-item">
										<div class="kv-key">Image ID</div>
										<div class="kv-value code">{selectedImage.id}</div>
									</div>

									<div class="kv-item">
										<div class="kv-key">Asset ID</div>
										<div class="kv-value">{selectedImage.assetId || '—'}</div>
									</div>

									<div class="kv-item">
										<div class="kv-key">Source kind</div>
										<div class="kv-value">{getImageSourceKind(selectedImage)}</div>
									</div>

									<div class="kv-item">
										<div class="kv-key">Source</div>
										<div class="kv-value code wrap">{getImageSourceValue(selectedImage)}</div>
									</div>

									<div class="kv-item">
										<div class="kv-key">Dimensions</div>
										<div class="kv-value">
											{selectedImage.dimensions.width} × {selectedImage.dimensions.height}
										</div>
									</div>

									<div class="kv-item">
										<div class="kv-key">Content hash</div>
										<div class="kv-value code wrap">{selectedImage.contentHash}</div>
									</div>

									{#if selectedImageAlignment}
										<div class="kv-item">
											<div class="kv-key">Alignment schema</div>
											<div class="kv-value">{selectedImageAlignment.schemaId}</div>
										</div>

										<div class="kv-item">
											<div class="kv-key">Transform model</div>
											<div class="kv-value">
												{selectedImageAlignment.result?.transformModel ?? '—'}
											</div>
										</div>
									{/if}
								</div>

								{#if getMetadataEntries(selectedImage.metadata).length > 0}
									<div class="meta-block">
										<h4>Metadata</h4>

										<div class="kv-grid compact">
											{#each getMetadataEntries(selectedImage.metadata) as [key, value]}
												<div class="kv-item">
													<div class="kv-key">{key}</div>
													<div class="kv-value">{formatValue(value)}</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}

								<details class="raw-block">
									<summary>Raw image record</summary>
									<pre>{pretty(selectedImage)}</pre>
								</details>
							</div>
						</div>
					</section>
				{/if}

				<section class="compact-panel">
					<div class="detail-head">
						<h3>Annotations</h3>
						<span class="pill">{selectedGroupAnnotations.length}</span>
					</div>

					{#if selectedGroupAnnotations.length === 0}
						<div class="empty-inline">No annotations recorded for this group</div>
					{:else}
						<div class="annotation-list">
							{#each selectedGroupAnnotations as annotation (annotation.id)}
								<div class="annotation-row">
									<div class="annotation-main">
										<div class="annotation-title">{annotation.schemaId}</div>
										<div class="annotation-sub">
											{geometrySummary(annotation.geometry)} · {annotation.targetImageIds.length} targets
										</div>
									</div>

									<div class="annotation-id">{annotation.id}</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else}
				<div class="empty-state main-empty">
					<h2>No group selected</h2>
				</div>
			{/if}
		</main>
	</div>
{/if}

<style>
	.workspace {
		display: flex;
		min-height: calc(100vh - 96px);
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.sidebar-shell {
		height: 100%;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: rgba(255, 255, 255, 0.92);
	}

	.sidebar-header {
		flex: 0 0 auto;
		padding: 0.9rem 0.9rem 0.75rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
	}

	.project-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.82rem;
		line-height: 1.2;
	}

	.project-name {
		font-weight: 700;
		color: #111827;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.project-created {
		color: #64748b;
		white-space: nowrap;
		font-size: 0.76rem;
	}

	.sidebar-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 0.8rem;
	}

	.sidebar-footer {
		flex: 0 0 auto;
		padding: 0.7rem 0.9rem;
		border-top: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
		font-size: 0.72rem;
		color: #64748b;
	}

	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.group-card {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		border-radius: 14px;
		padding: 0.65rem;
		display: grid;
		grid-template-columns: 54px minmax(0, 1fr);
		gap: 0.65rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.group-card:hover {
		transform: translateY(-1px);
		border-color: rgba(59, 130, 246, 0.34);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
	}

	.group-card.selected {
		border-color: rgba(37, 99, 235, 0.48);
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.group-thumb {
		width: 54px;
		height: 54px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.group-copy {
		min-width: 0;
	}

	.group-title-row,
	.image-title-row,
	.detail-head,
	.group-header-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.group-title {
		font-weight: 700;
		font-size: 0.88rem;
		color: #111827;
		min-width: 0;
	}

	.group-count,
	.group-subline,
	.group-id,
	.image-subline,
	.image-path,
	.image-hash,
	.group-header-sub,
	.annotation-sub,
	.annotation-id {
		font-size: 0.73rem;
		color: #64748b;
	}

	.group-subline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.22rem;
	}

	.group-id,
	.image-path,
	.image-hash,
	.code,
	.wrap,
	code {
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.main {
		flex: 1 1 auto;
		min-width: 0;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.group-header-card,
	.detail-card,
	.compact-panel {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		box-shadow:
			0 10px 30px rgba(15, 23, 42, 0.05),
			0 2px 8px rgba(15, 23, 42, 0.04);
		padding: 1rem;
	}

	.group-header-main h2,
	.detail-title,
	.detail-head h3,
	.compact-panel h3 {
		margin: 0;
		color: #111827;
	}

	.group-header-main h2 {
		font-size: 1.05rem;
	}

	.group-header-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.pill,
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		background: #eef2ff;
		color: #334155;
		border: 1px solid rgba(51, 65, 85, 0.08);
		white-space: nowrap;
	}

	.pill.ok,
	.badge.ok {
		background: rgba(16, 185, 129, 0.12);
		color: #047857;
	}

	.badge.base {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.badge.muted {
		background: rgba(148, 163, 184, 0.12);
		color: #64748b;
	}

	.image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
		gap: 0.8rem;
	}

	.image-card {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		border-radius: 14px;
		padding: 0.75rem;
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 0.75rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.image-card:hover {
		transform: translateY(-1px);
		border-color: rgba(59, 130, 246, 0.34);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
	}

	.image-card.selected {
		border-color: rgba(37, 99, 235, 0.48);
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.image-card.base {
		border-left: 4px solid #2563eb;
	}

	.image-thumb,
	.detail-thumb {
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.image-thumb {
		width: 88px;
		height: 88px;
	}

	.image-copy {
		min-width: 0;
	}

	.image-title {
		font-size: 0.88rem;
		font-weight: 700;
		color: #111827;
		min-width: 0;
	}

	.image-subline {
		margin-top: 0.24rem;
	}

	.image-path,
	.image-hash {
		margin-top: 0.18rem;
	}

	.detail-layout {
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		gap: 1rem;
		margin-top: 0.85rem;
	}

	.detail-thumb {
		width: 180px;
		height: 180px;
	}

	.detail-copy {
		min-width: 0;
	}

	.detail-title {
		font-size: 0.95rem;
		font-weight: 700;
		margin-bottom: 0.7rem;
	}

	.kv-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.kv-grid.compact {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 0.55rem;
	}

	.kv-item {
		padding: 0.6rem 0.7rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.06);
		min-width: 0;
	}

	.kv-key {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.22rem;
	}

	.kv-value {
		font-size: 0.84rem;
		color: #111827;
	}

	.meta-block {
		margin-top: 0.9rem;
	}

	.meta-block h4 {
		margin: 0 0 0.45rem;
		font-size: 0.82rem;
		color: #334155;
	}

	.annotation-list {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.8rem;
	}

	.annotation-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	.annotation-main {
		min-width: 0;
	}

	.annotation-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: #111827;
	}

	.raw-block {
		margin-top: 0.8rem;
	}

	.raw-block summary {
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 700;
		color: #334155;
	}

	.raw-block pre {
		margin: 0.65rem 0 0;
		padding: 0.8rem;
		border-radius: 12px;
		background: #0f172a;
		color: #e2e8f0;
		font-size: 0.74rem;
		line-height: 1.45;
		overflow: auto;
		max-height: 260px;
	}

	.empty,
	.empty-inline,
	.thumb-fallback,
	.empty-state {
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
	}

	.empty,
	.thumb-fallback,
	.empty-inline {
		border: 1px dashed rgba(15, 23, 42, 0.16);
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.9);
		padding: 1rem;
		font-size: 0.82rem;
	}

	.empty-state {
		min-height: calc(100vh - 96px);
		padding: 2rem;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.main-empty {
		min-height: auto;
		background: transparent;
		padding: 0;
	}

	@media (max-width: 900px) {
		.detail-layout {
			grid-template-columns: 1fr;
		}

		.detail-thumb {
			width: 180px;
			height: 180px;
		}

		.kv-grid,
		.kv-grid.compact {
			grid-template-columns: 1fr;
		}

		.annotation-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
