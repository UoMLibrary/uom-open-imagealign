<script lang="ts">
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import GroupCell from '$lib/ui/shared/GroupCell.svelte';
	import ImageCard from '$lib/ui/shared/ImageCard.svelte';
	import ImageDetailCard from '$lib/ui/shared/ImageDetailCard.svelte';
	import GroupAnnotationsPanel from '$lib/ui/shared/GroupAnnotationsPanel.svelte';

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

								<GroupCell
									{group}
									selected={group.id === selectedGroupId}
									baseImageContentHash={baseImage?.contentHash ?? null}
									alignmentCount={stats?.alignmentCount ?? 0}
									annotationCount={stats?.annotationCount ?? 0}
									onSelect={selectGroup}
								/>
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
					<div class="group-line">
						<div class="group-name">
							Group: {getGroupLabel(selectedGroup)}
							<span class="group-header-sub">
								<code>({selectedGroup.id})</code>
							</span>
						</div>

						<div class="group-summary">
							{selectedGroup.imageIds.length} images · {selectedGroupAlignments.length} alignments ·
							{selectedGroupAnnotations.length} annotations
						</div>
					</div>
				</section>

				<!-- Show the images in the selected group -->
				<section class="image-grid">
					{#each selectedGroupImages as image (image.id)}
						{@const alignment = alignmentByComparedId.get(image.id)}

						<ImageCard
							{image}
							title={getImageTitle(image)}
							sourceKind={getImageSourceKind(image)}
							sourceValue={getImageSourceValue(image)}
							selected={image.id === selectedImageId}
							isBase={image.id === selectedGroup.baseImageId}
							alignmentStatus={alignment?.status ?? null}
							onSelect={selectImage}
						/>
					{/each}
				</section>

				{#if selectedImage}
					<div class="panel-wrap">
						<ImageDetailCard
							image={selectedImage}
							baseImage={selectedGroup ? (imageById.get(selectedGroup.baseImageId) ?? null) : null}
							title={getImageTitle(selectedImage)}
							sourceKind={selectedImage.source.kind}
							sourceValue={getImageSourceValue(selectedImage)}
							isBase={selectedImage.id === selectedGroup?.baseImageId}
							alignment={selectedImageAlignment}
							{formatValue}
							{pretty}
						/>
					</div>
				{/if}
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

	.group-header-sub {
		font-size: 0.73rem;
		color: #64748b;
	}

	code {
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.main {
		flex: 1 1 auto;
		min-width: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.group-header-card {
		flex: 0 0 auto;
		padding: 0.9rem 1rem 0.75rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
		border-radius: 0;
		border-left: 0;
		border-right: 0;
		border-top: 0;
		box-shadow: none;
	}

	.panel-wrap {
		margin-left: 1rem;
		margin-right: 1rem;
	}

	.group-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.82rem;
		line-height: 1.2;
	}

	.group-name {
		font-weight: 700;
		font-size: 1rem;
		color: #111827;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.group-summary {
		color: #64748b;
		white-space: nowrap;
		font-size: 0.76rem;
	}

	.group-header-sub {
		margin-top: 0.3rem;
		font-size: 0.73rem;
		color: #64748b;
	}

	.image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
		gap: 0.8rem;
	}

	.image-grid {
		margin-left: 1rem;
		margin-right: 1rem;
	}

	.image-grid {
		margin-top: 1rem;
	}

	.empty,
	.empty-state {
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
	}

	.empty {
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
		.group-line {
			flex-direction: column;
			align-items: flex-start;
		}

		.group-summary {
			white-space: normal;
		}
	}
</style>
