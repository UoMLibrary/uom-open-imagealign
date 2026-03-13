<script lang="ts">
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';
	import { projectState } from '$lib/core/projectStore.svelte';

	let selectedGroupId = $state<string | null>(null);
	let selectedImageId = $state<string | null>(null);

	let project = $derived(projectState.project);
	let groups = $derived(project?.groups ?? []);
	let images = $derived(project?.images ?? []);
	let alignments = $derived(project?.alignments ?? []);
	let annotations = $derived(project?.annotations ?? []);
	let assetRoots = $derived(project?.assetRoots ?? []);
	let metadataSchemas = $derived(project?.definitions?.metadataSchemas ?? []);
	let alignmentSchemas = $derived(project?.definitions?.alignmentSchemas ?? []);
	let annotationSchemas = $derived(project?.definitions?.annotationSchemas ?? []);

	let imageById = $derived.by(() => {
		const map = new Map<string, any>();

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
		return selectedGroup.imageIds.map((imageId) => imageById.get(imageId)).filter(Boolean);
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
		const map = new Map<string, any>();

		for (const alignment of selectedGroupAlignments) {
			map.set(alignment.comparedImageId, alignment);
		}

		return map;
	});

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

	function getGroupLabel(group: any): string {
		return group.label?.trim?.() || group.id;
	}

	function getImageTitle(image: any): string {
		const title = image?.metadata?.title;
		if (typeof title === 'string' && title.trim()) return title;
		if (typeof image?.label === 'string' && image.label.trim()) return image.label;
		return image?.id ?? 'Untitled image';
	}

	function getImageSourceKind(image: any): string {
		const kind = image?.source?.kind;
		if (kind === 'iiif') return 'IIIF';
		if (kind === 'url') return 'URL';
		if (kind === 'local') return 'Local';
		return 'Unknown';
	}

	function getImageSourceValue(image: any): string {
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

	function geometrySummary(geometry: any): string {
		if (!geometry) return '—';

		if (geometry.type === 'rect' && geometry.value) {
			const { x, y, w, h } = geometry.value;
			return `rect x:${roundish(x)} y:${roundish(y)} w:${roundish(w)} h:${roundish(h)}`;
		}

		if (geometry.type === 'point' && geometry.value) {
			const { x, y } = geometry.value;
			return `point x:${roundish(x)} y:${roundish(y)}`;
		}

		if ((geometry.type === 'polygon' || geometry.type === 'line') && geometry.value?.points) {
			return `${geometry.type} (${geometry.value.points.length} points)`;
		}

		return geometry.type ?? 'geometry';
	}

	function roundish(value: unknown): string {
		if (typeof value !== 'number') return String(value ?? '');
		return value.toFixed(3).replace(/\.?0+$/, '');
	}

	function pretty(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}

	function countMetadataValues(scope: 'project' | 'image' | 'group' | 'annotation' | 'alignment') {
		if (!project) return 0;

		if (scope === 'project') {
			return getMetadataEntries(project.metadata).length;
		}

		if (scope === 'image') {
			return images.reduce((sum, image) => sum + getMetadataEntries(image.metadata).length, 0);
		}

		if (scope === 'group') {
			return groups.reduce((sum, group) => sum + getMetadataEntries(group.metadata).length, 0);
		}

		if (scope === 'annotation') {
			return annotations.reduce(
				(sum, annotation) =>
					sum +
					getMetadataEntries(annotation.metadata).length +
					getMetadataEntries(annotation.data).length,
				0
			);
		}

		if (scope === 'alignment') {
			return alignments.reduce(
				(sum, alignment) => sum + getMetadataEntries(alignment.metadata).length,
				0
			);
		}

		return 0;
	}
</script>

{#if !project}
	<div class="empty-state">
		<h2>No project loaded</h2>
		<p>
			Open a project, create one from a folder, or import from a spreadsheet to see the project
			structure here.
		</p>
	</div>
{:else}
	<div class="workspace">
		<aside class="sidebar">
			<section class="panel project-summary">
				<div class="panel-head">
					<h2>{project.title || 'Untitled project'}</h2>
					<div class="status-row">
						<span class:dirty={projectState.dirty} class="pill">
							{projectState.dirty ? 'Unsaved changes' : 'Saved'}
						</span>

						{#if projectState.busyAction}
							<span class="pill info">{projectState.busyAction}</span>
						{/if}
					</div>
				</div>

				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-label">Images</div>
						<div class="stat-value">{images.length}</div>
					</div>

					<div class="stat-card">
						<div class="stat-label">Groups</div>
						<div class="stat-value">{groups.length}</div>
					</div>

					<div class="stat-card">
						<div class="stat-label">Alignments</div>
						<div class="stat-value">{alignments.length}</div>
					</div>

					<div class="stat-card">
						<div class="stat-label">Annotations</div>
						<div class="stat-value">{annotations.length}</div>
					</div>
				</div>

				<div class="meta-grid">
					<div>
						<div class="mini-label">Created</div>
						<div class="mini-value">{project.createdAt}</div>
					</div>
					<div>
						<div class="mini-label">Updated</div>
						<div class="mini-value">{project.updatedAt || '—'}</div>
					</div>
					<div>
						<div class="mini-label">Asset roots</div>
						<div class="mini-value">{assetRoots.length}</div>
					</div>
					<div>
						<div class="mini-label">Project metadata</div>
						<div class="mini-value">{countMetadataValues('project')}</div>
					</div>
				</div>

				{#if projectState.lastError}
					<div class="message error">{projectState.lastError}</div>
				{/if}

				{#if projectState.lastInfo}
					<div class="message info">{projectState.lastInfo}</div>
				{/if}
			</section>

			<section class="panel">
				<div class="section-head">
					<h3>Groups</h3>
					<span class="count">{groups.length}</span>
				</div>

				{#if groups.length === 0}
					<div class="empty-small">No groups yet</div>
				{:else}
					<div class="group-list">
						{#each groups as group (group.id)}
							{@const baseImage = imageById.get(group.baseImageId)}
							{@const stats = groupStats.get(group.id)}

							<button
								type="button"
								class:selected={group.id === selectedGroupId}
								class="group-row"
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
									<div class="group-title">{getGroupLabel(group)}</div>
									<div class="group-sub">
										<span>{group.imageIds.length} images</span>
										<span>{stats?.alignmentCount ?? 0} alignments</span>
										<span>{stats?.annotationCount ?? 0} annotations</span>
									</div>
									<div class="group-id">{group.id}</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</section>
		</aside>

		<main class="main">
			{#if selectedGroup}
				<section class="panel">
					<div class="section-head">
						<div>
							<h2>{getGroupLabel(selectedGroup)}</h2>
							<div class="subtitle">
								Group ID: <code>{selectedGroup.id}</code>
							</div>
						</div>

						<div class="group-badges">
							<span class="pill">{selectedGroup.imageIds.length} images</span>
							<span class="pill">{selectedGroupAlignments.length} alignments</span>
							<span class="pill">{selectedGroupAnnotations.length} annotations</span>
						</div>
					</div>

					{#if getMetadataEntries(selectedGroup.metadata).length > 0}
						<div class="kv-block">
							<h4>Group metadata</h4>
							<div class="kv-list">
								{#each getMetadataEntries(selectedGroup.metadata) as [key, value]}
									<div class="kv-item">
										<div class="kv-key">{key}</div>
										<div class="kv-value">{formatValue(value)}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="image-grid">
						{#each selectedGroupImages as image (image.id)}
							{@const alignment = alignmentByComparedId.get(image.id)}
							<button
								type="button"
								class:selected={image.id === selectedImageId}
								class:base={image.id === selectedGroup.baseImageId}
								class="image-card"
								onclick={() => selectImage(image.id)}
							>
								<div class="image-thumb">
									<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
								</div>

								<div class="image-copy">
									<div class="image-topline">
										<div class="image-title">{getImageTitle(image)}</div>

										{#if image.id === selectedGroup.baseImageId}
											<span class="badge base">Base</span>
										{:else if alignment}
											<span class="badge ok">{alignment.status}</span>
										{:else}
											<span class="badge muted">Unaligned</span>
										{/if}
									</div>

									<div class="image-meta-line">
										{getImageSourceKind(image)} · {image.dimensions.width} × {image.dimensions
											.height}
									</div>
									<div class="path">{getImageSourceValue(image)}</div>
									<div class="hash">hash: {image.contentHash}</div>
								</div>
							</button>
						{/each}
					</div>
				</section>

				<div class="two-col">
					<section class="panel detail-panel">
						<div class="section-head">
							<h3>Selected image</h3>
						</div>

						{#if selectedImage}
							<div class="selected-image">
								<div class="selected-thumb">
									<CachedThumb
										contentHash={selectedImage.contentHash}
										alt={getImageTitle(selectedImage)}
									/>
								</div>

								<div class="selected-copy">
									<h4>{getImageTitle(selectedImage)}</h4>

									<div class="kv-list compact">
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
									</div>

									{#if getMetadataEntries(selectedImage.metadata).length > 0}
										<div class="kv-block">
											<h4>Image metadata</h4>
											<div class="kv-list compact">
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
						{:else}
							<div class="empty-small">No image selected</div>
						{/if}
					</section>

					<section class="panel detail-panel">
						<div class="section-head">
							<h3>Alignments</h3>
							<span class="count">{selectedGroupAlignments.length}</span>
						</div>

						{#if selectedGroupAlignments.length === 0}
							<div class="empty-small">No alignments recorded for this group</div>
						{:else}
							<div class="stack-list">
								{#each selectedGroupAlignments as alignment (alignment.id)}
									{@const comparedImage = imageById.get(alignment.comparedImageId)}
									<div class="stack-card">
										<div class="stack-head">
											<div>
												<div class="stack-title">
													{comparedImage ? getImageTitle(comparedImage) : alignment.comparedImageId}
												</div>
												<div class="stack-sub">{alignment.id}</div>
											</div>

											<div class="stack-badges">
												<span class="badge ok">{alignment.status}</span>
												<span class="badge">{alignment.schemaId}</span>
											</div>
										</div>

										<div class="kv-list compact">
											<div class="kv-item">
												<div class="kv-key">Compared image</div>
												<div class="kv-value code">{alignment.comparedImageId}</div>
											</div>
											<div class="kv-item">
												<div class="kv-key">Confidence</div>
												<div class="kv-value">{alignment.confidence ?? '—'}</div>
											</div>
											<div class="kv-item">
												<div class="kv-key">Transform model</div>
												<div class="kv-value">{alignment.result?.transformModel ?? '—'}</div>
											</div>
										</div>

										<details class="raw-block">
											<summary>Raw alignment record</summary>
											<pre>{pretty(alignment)}</pre>
										</details>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				</div>

				<div class="two-col">
					<section class="panel detail-panel">
						<div class="section-head">
							<h3>Annotations</h3>
							<span class="count">{selectedGroupAnnotations.length}</span>
						</div>

						{#if selectedGroupAnnotations.length === 0}
							<div class="empty-small">No annotations recorded for this group</div>
						{:else}
							<div class="stack-list">
								{#each selectedGroupAnnotations as annotation (annotation.id)}
									<div class="stack-card">
										<div class="stack-head">
											<div>
												<div class="stack-title">{annotation.schemaId}</div>
												<div class="stack-sub">{annotation.id}</div>
											</div>

											<div class="stack-badges">
												<span class="badge">{annotation.geometry?.type ?? 'geometry'}</span>
												<span class="badge">{annotation.targetImageIds?.length ?? 0} targets</span>
											</div>
										</div>

										<div class="kv-list compact">
											<div class="kv-item">
												<div class="kv-key">Anchor image</div>
												<div class="kv-value code">{annotation.anchorImageId}</div>
											</div>
											<div class="kv-item">
												<div class="kv-key">Targets</div>
												<div class="kv-value code wrap">
													{annotation.targetImageIds?.join(', ')}
												</div>
											</div>
											<div class="kv-item">
												<div class="kv-key">Geometry</div>
												<div class="kv-value">{geometrySummary(annotation.geometry)}</div>
											</div>
											{#if annotation.alignmentId}
												<div class="kv-item">
													<div class="kv-key">Alignment</div>
													<div class="kv-value code">{annotation.alignmentId}</div>
												</div>
											{/if}
										</div>

										{#if getMetadataEntries(annotation.data).length > 0}
											<div class="kv-block">
												<h4>Annotation data</h4>
												<div class="kv-list compact">
													{#each getMetadataEntries(annotation.data) as [key, value]}
														<div class="kv-item">
															<div class="kv-key">{key}</div>
															<div class="kv-value">{formatValue(value)}</div>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										<details class="raw-block">
											<summary>Raw annotation record</summary>
											<pre>{pretty(annotation)}</pre>
										</details>
									</div>
								{/each}
							</div>
						{/if}
					</section>

					<section class="panel detail-panel">
						<div class="section-head">
							<h3>Definitions</h3>
						</div>

						<div class="definition-grid">
							<div class="definition-card">
								<div class="definition-title">Metadata schemas</div>
								<div class="definition-count">{metadataSchemas.length}</div>
								<div class="definition-sub">
									{countMetadataValues('image')} image metadata values
								</div>
							</div>

							<div class="definition-card">
								<div class="definition-title">Alignment schemas</div>
								<div class="definition-count">{alignmentSchemas.length}</div>
								<div class="definition-sub">{alignments.length} alignment records</div>
							</div>

							<div class="definition-card">
								<div class="definition-title">Annotation schemas</div>
								<div class="definition-count">{annotationSchemas.length}</div>
								<div class="definition-sub">{annotations.length} annotation records</div>
							</div>

							<div class="definition-card">
								<div class="definition-title">Asset roots</div>
								<div class="definition-count">{assetRoots.length}</div>
								<div class="definition-sub">
									{projectState.projectHandle?.name || 'Unsaved project'}
								</div>
							</div>
						</div>

						<details class="raw-block">
							<summary>Metadata schema definitions</summary>
							<pre>{pretty(metadataSchemas)}</pre>
						</details>

						<details class="raw-block">
							<summary>Alignment schema definitions</summary>
							<pre>{pretty(alignmentSchemas)}</pre>
						</details>

						<details class="raw-block">
							<summary>Annotation schema definitions</summary>
							<pre>{pretty(annotationSchemas)}</pre>
						</details>
					</section>
				</div>
			{:else}
				<section class="panel">
					<div class="empty-small">This project has no groups.</div>
				</section>
			{/if}
		</main>
	</div>
{/if}

<style>
	:global(*) {
		box-sizing: border-box;
	}

	.workspace {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		gap: 1rem;
		padding: 1rem;
		min-height: calc(100vh - 96px);
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.sidebar,
	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		box-shadow:
			0 10px 30px rgba(15, 23, 42, 0.05),
			0 2px 8px rgba(15, 23, 42, 0.04);
		padding: 1rem;
		min-width: 0;
	}

	.panel-head,
	.section-head,
	.stack-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	h2,
	h3,
	h4 {
		margin: 0;
		color: #0f172a;
	}

	h2 {
		font-size: 1.05rem;
	}

	h3 {
		font-size: 0.95rem;
	}

	h4 {
		font-size: 0.86rem;
		margin-bottom: 0.55rem;
	}

	.subtitle,
	.stack-sub,
	.group-id,
	.path,
	.hash,
	.image-meta-line,
	.definition-sub,
	.mini-value {
		font-size: 0.76rem;
		color: #64748b;
	}

	.group-id,
	.hash,
	.path,
	.code,
	.wrap {
		word-break: break-word;
	}

	.status-row,
	.group-badges,
	.stack-badges {
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
	}

	.pill.info,
	.badge.ok {
		background: rgba(16, 185, 129, 0.12);
		color: #047857;
	}

	.pill.dirty {
		background: rgba(245, 158, 11, 0.14);
		color: #b45309;
	}

	.badge.base {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.badge.muted {
		background: rgba(148, 163, 184, 0.12);
		color: #64748b;
	}

	.stats-grid,
	.definition-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.stat-card,
	.definition-card {
		border-radius: 14px;
		padding: 0.85rem;
		background: linear-gradient(180deg, #f8fafc, #f1f5f9);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	.stat-label,
	.definition-title,
	.mini-label {
		font-size: 0.74rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.stat-value,
	.definition-count {
		font-size: 1.25rem;
		font-weight: 800;
		color: #0f172a;
		margin-top: 0.2rem;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	.message {
		margin-top: 0.85rem;
		padding: 0.7rem 0.85rem;
		border-radius: 12px;
		font-size: 0.82rem;
	}

	.message.error {
		background: rgba(239, 68, 68, 0.1);
		color: #991b1b;
	}

	.message.info {
		background: rgba(59, 130, 246, 0.1);
		color: #1d4ed8;
	}

	.count {
		font-size: 0.8rem;
		font-weight: 700;
		color: #64748b;
	}

	.group-list,
	.stack-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.group-row,
	.image-card {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		border-radius: 14px;
		cursor: pointer;
		text-align: left;
		padding: 0.7rem;
		color: inherit;
		transition:
			transform 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.group-row:hover,
	.image-card:hover {
		transform: translateY(-1px);
		border-color: rgba(59, 130, 246, 0.35);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
	}

	.group-row.selected,
	.image-card.selected {
		border-color: rgba(37, 99, 235, 0.5);
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.image-card.base {
		border-left: 4px solid #2563eb;
	}

	.group-row {
		display: grid;
		grid-template-columns: 68px minmax(0, 1fr);
		gap: 0.75rem;
		align-items: center;
	}

	.group-thumb,
	.image-thumb,
	.selected-thumb {
		overflow: hidden;
		border-radius: 12px;
		background: #f8fafc;
		border: 1px solid rgba(15, 23, 42, 0.07);
	}

	.group-thumb {
		width: 68px;
		height: 68px;
	}

	.image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.image-card {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 0.75rem;
		align-items: start;
	}

	.image-thumb {
		width: 88px;
		height: 88px;
	}

	.group-title,
	.image-title,
	.stack-title {
		font-size: 0.88rem;
		font-weight: 700;
		color: #0f172a;
	}

	.group-sub,
	.image-topline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: center;
		justify-content: space-between;
	}

	.group-sub {
		font-size: 0.74rem;
		color: #64748b;
		margin: 0.22rem 0 0.32rem;
	}

	.thumb-fallback,
	.empty-small,
	.empty-state {
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
	}

	.thumb-fallback,
	.empty-small {
		min-height: 86px;
		border: 1px dashed rgba(15, 23, 42, 0.16);
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.9);
		font-size: 0.84rem;
		padding: 1rem;
	}

	.empty-state {
		min-height: calc(100vh - 96px);
		padding: 2rem;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(243, 244, 246, 0.98));
	}

	.empty-state h2 {
		font-size: 1.2rem;
		margin-bottom: 0.5rem;
	}

	.two-col {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.detail-panel {
		min-height: 0;
	}

	.selected-image {
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		gap: 1rem;
	}

	.selected-thumb {
		width: 180px;
		height: 180px;
	}

	.kv-block {
		margin-top: 0.95rem;
	}

	.kv-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem 0.75rem;
	}

	.kv-list.compact {
		grid-template-columns: 1fr;
	}

	.kv-item {
		padding: 0.55rem 0.65rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.06);
		min-width: 0;
	}

	.kv-key {
		font-size: 0.72rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.24rem;
	}

	.kv-value {
		font-size: 0.84rem;
		color: #0f172a;
	}

	.kv-value.code,
	code {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.76rem;
	}

	.stack-card {
		padding: 0.85rem;
		border-radius: 14px;
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		border: 1px solid rgba(15, 23, 42, 0.08);
	}

	.raw-block {
		margin-top: 0.8rem;
	}

	.raw-block summary {
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 700;
		color: #334155;
	}

	.raw-block pre {
		margin: 0.7rem 0 0;
		padding: 0.85rem;
		border-radius: 12px;
		background: #0f172a;
		color: #e2e8f0;
		font-size: 0.74rem;
		line-height: 1.45;
		overflow: auto;
		max-height: 280px;
	}

	@media (max-width: 1200px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.two-col {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.selected-image {
			grid-template-columns: 1fr;
		}

		.selected-thumb {
			width: 100%;
			max-width: 220px;
			height: 220px;
		}

		.stats-grid,
		.meta-grid,
		.definition-grid,
		.kv-list {
			grid-template-columns: 1fr;
		}

		.image-card {
			grid-template-columns: 72px minmax(0, 1fr);
		}

		.image-thumb {
			width: 72px;
			height: 72px;
		}
	}
</style>
