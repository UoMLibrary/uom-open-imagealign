<script lang="ts">
	import { onDestroy } from 'svelte';

	import WorkspaceSidebar from '$lib/ui/workspace/WorkspaceSidebar.svelte';
	import GroupListItem from '$lib/ui/workspace/GroupListItem.svelte';
	import GroupAnnotationsPanel from '$lib/ui/workspace/GroupAnnotationsPanel.svelte';
	import AnnotatedImageCompareViewer from '$lib/ui/compare/AnnotatedImageCompareViewer.svelte';
	import { createAnnotationCompareSession } from '$lib/ui/compare/annotationCompareSession';
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	import { getDerivedUrl } from '$lib/images/derivationService';
	import { getDerivationCacheKey } from '$lib/images/derivationState.svelte';
	import {
		getProjectAnnotationConfig,
		mutateProject,
		projectState
	} from '$lib/project/projectStore.svelte';

	let leftPanelOpen = $state(true);
	let rightPanelOpen = $state(true);
	let selectedGroupId = $state<string | null>(null);
	let selectedImageId = $state<string | null>(null);
	let referenceImageId = $state<string | null>(null);
	let selectedAnnotationId = $state<string | null>(null);
	let alignmentApproach = $state<'auto' | 'feature' | 'manual'>('auto');

	let project = $derived(projectState.project);
	let groups = $derived(project?.groups ?? []);
	let images = $derived(project?.images ?? []);
	let alignments = $derived(project?.alignments ?? []);
	let annotations = $derived(project?.annotations ?? []);
	let annotationConfig = $derived(getProjectAnnotationConfig(project));

	let imageById = $derived.by(() => {
		const map = new Map<string, (typeof images)[number]>();

		for (const image of images) {
			map.set(image.id, image);
		}

		return map;
	});

	let imageTitleById = $derived.by(() => {
		const map = new Map<string, string>();

		for (const image of images) {
			map.set(image.id, getImageTitle(image));
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

	let referenceImage = $derived(
		referenceImageId
			? (selectedGroupImages.find((image) => image.id === referenceImageId) ?? null)
			: null
	);

	let baseImage = $derived(
		selectedGroup ? (imageById.get(selectedGroup.baseImageId) ?? selectedGroupImages[0] ?? null) : null
	);

	let comparedImage = $derived.by(() => {
		if (!selectedGroup || selectedGroupImages.length === 0) return null;
		if (!selectedImage) return null;
		if (selectedImage.id !== referenceImage?.id) return selectedImage;

		return selectedGroupImages.find((image) => image.id !== referenceImage?.id) ?? selectedImage;
	});

	let activePairImageIds = $derived.by(() => {
		const ids = [referenceImage?.id, comparedImage?.id].filter(Boolean) as string[];
		return Array.from(new Set(ids));
	});

	let alignmentByComparedId = $derived.by(() => {
		const map = new Map<string, (typeof alignments)[number]>();

		for (const alignment of selectedGroupAlignments) {
			map.set(alignment.comparedImageId, alignment);
		}

		return map;
	});

	let activeAlignment = $derived.by(() => {
		if (!selectedGroup || !referenceImage || !comparedImage) return null;
		if (referenceImage.id !== selectedGroup.baseImageId) return null;
		if (comparedImage.id === selectedGroup.baseImageId) return null;
		return alignmentByComparedId.get(comparedImage.id) ?? null;
	});

	function annotationIncludesPair(
		annotation: (typeof annotations)[number],
		anchorId: string | null,
		comparedId: string | null
	): boolean {
		if (!anchorId || !comparedId) return false;
		if (annotation.anchorImageId === anchorId && annotation.targetImageIds.includes(comparedId)) {
			return true;
		}

		const allIds = new Set([annotation.anchorImageId, ...annotation.targetImageIds]);
		return allIds.has(anchorId) && allIds.has(comparedId);
	}

	let activePairAnnotations = $derived.by(() => {
		if (!referenceImage || !comparedImage) return [];

		return selectedGroupAnnotations.filter((annotation) =>
			annotationIncludesPair(annotation, referenceImage.id, comparedImage.id)
		);
	});

	let orderedGroupAnnotations = $derived.by(() => {
		const activeIds = new Set(activePairAnnotations.map((annotation) => annotation.id));

		return [...selectedGroupAnnotations].sort((a, b) => {
			const aActive = activeIds.has(a.id);
			const bActive = activeIds.has(b.id);
			if (aActive !== bActive) return aActive ? -1 : 1;
			return a.id.localeCompare(b.id);
		});
	});

	let selectedAnnotation = $derived(
		selectedAnnotationId
			? (selectedGroupAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null)
			: null
	);

	const compareSession = createAnnotationCompareSession({
		annotations: []
	});

	$effect(() => {
		compareSession.setAnnotations(activePairAnnotations);

		if (!selectedAnnotationId || !activePairAnnotations.some((annotation) => annotation.id === selectedAnnotationId)) {
			compareSession.selectAnnotation(null);
			return;
		}

		compareSession.selectAnnotation(selectedAnnotationId);
	});

	$effect(() => {
		if (!project) {
			selectedGroupId = null;
			selectedImageId = null;
			referenceImageId = null;
			selectedAnnotationId = null;
			return;
		}

		if (!selectedGroupId || !groups.some((group) => group.id === selectedGroupId)) {
			selectedGroupId = groups[0]?.id ?? null;
		}
	});

	$effect(() => {
		if (!selectedGroup) {
			selectedImageId = null;
			referenceImageId = null;
			selectedAnnotationId = null;
			return;
		}

		if (!referenceImageId || !selectedGroup.imageIds.includes(referenceImageId)) {
			referenceImageId = selectedGroup.baseImageId ?? selectedGroup.imageIds[0] ?? null;
		}

		const defaultComparedImageId =
			selectedGroup.imageIds.find((imageId) => imageId !== referenceImageId) ?? referenceImageId;

		if (!selectedImageId || !selectedGroup.imageIds.includes(selectedImageId)) {
			selectedImageId = defaultComparedImageId ?? null;
			return;
		}

		if (selectedImageId === referenceImageId && defaultComparedImageId && defaultComparedImageId !== referenceImageId) {
			selectedImageId = defaultComparedImageId;
		}
	});

	$effect(() => {
		if (!selectedAnnotationId) return;
		if (selectedGroupAnnotations.some((annotation) => annotation.id === selectedAnnotationId)) return;
		selectedAnnotationId = null;
	});

	function selectGroup(groupId: string) {
		selectedGroupId = groupId;
		selectedAnnotationId = null;
	}

	function selectComparedImage(imageId: string) {
		selectedImageId = imageId;
		selectedAnnotationId = null;
	}

	function selectReferenceImage(imageId: string) {
		referenceImageId = imageId;
		selectedAnnotationId = null;

		if (selectedImageId === imageId) {
			const fallback = selectedGroupImages.find((image) => image.id !== imageId);
			selectedImageId = fallback?.id ?? imageId;
		}
	}

	function selectAnnotation(annotationId: string) {
		const annotation = selectedGroupAnnotations.find((item) => item.id === annotationId);
		if (!annotation) return;

		selectedAnnotationId = annotation.id;
		referenceImageId = annotation.anchorImageId;

		const targetImageId =
			annotation.targetImageIds.find((imageId) => imageId !== annotation.anchorImageId) ??
			annotation.targetImageIds[0] ??
			null;

		if (targetImageId) {
			selectedImageId = targetImageId;
		}

		rightPanelOpen = true;
	}

	function setSelectedAsBaseImage() {
		if (!selectedGroup || !comparedImage) return;
		if (selectedGroupAlignments.length > 0) return;
		if (comparedImage.id === selectedGroup.baseImageId) return;

		mutateProject((nextProject) => {
			const targetGroup = nextProject.groups.find((group) => group.id === selectedGroup.id);
			if (!targetGroup) return;
			targetGroup.baseImageId = comparedImage.id;
		});

		referenceImageId = comparedImage.id;
	}

	function confirmAlignment() {
		if (!activeAlignment || activeAlignment.status === 'confirmed') return;

		mutateProject((nextProject) => {
			const alignment = nextProject.alignments.find((item) => item.id === activeAlignment.id);
			if (!alignment) return;
			alignment.status = 'confirmed';
		});
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

	function getStatusTone(status: string | null): 'confirmed' | 'draft' | 'idle' {
		if (status === 'confirmed') return 'confirmed';
		if (status === 'draft') return 'draft';
		return 'idle';
	}

	let baseUrl: string | null = $state(null);
	let overlayUrl: string | null = $state(null);
	let baseRelease: (() => void) | null = $state(null);
	let overlayRelease: (() => void) | null = $state(null);
	let previewState: 'idle' | 'loading' | 'ready' | 'missing' = $state('idle');
	let previewRunId = 0;
	let previewKey: string | null = $state(null);
	let viewerRefreshKey = $state(0);

	function cleanupPreview() {
		baseRelease?.();
		baseRelease = null;

		overlayRelease?.();
		overlayRelease = null;

		baseUrl = null;
		overlayUrl = null;
	}

	async function loadPreview(nextBaseHash: string, nextOverlayHash: string) {
		const id = ++previewRunId;

		cleanupPreview();
		previewState = 'loading';

		try {
			const [baseRes, overlayRes] = await Promise.all([
				getDerivedUrl(nextBaseHash, 'work'),
				getDerivedUrl(nextOverlayHash, 'work')
			]);

			if (id !== previewRunId) {
				baseRes.release();
				overlayRes.release();
				return;
			}

			baseRelease = baseRes.release;
			overlayRelease = overlayRes.release;
			baseUrl = baseRes.url;
			overlayUrl = overlayRes.url;
			previewState = 'ready';
			viewerRefreshKey += 1;
		} catch (error) {
			console.error('Error loading comparison preview', error);

			if (id !== previewRunId) return;

			cleanupPreview();
			previewState = 'missing';
		}
	}

	$effect(() => {
		const currentBaseHash = referenceImage?.contentHash ?? '';
		const currentOverlayHash = comparedImage?.contentHash ?? currentBaseHash;
		const nextKey = [
			currentBaseHash ? getDerivationCacheKey(currentBaseHash) : '',
			currentOverlayHash ? getDerivationCacheKey(currentOverlayHash) : '',
			referenceImage?.id ?? '',
			comparedImage?.id ?? ''
		].join('|');

		if (nextKey === previewKey) return;
		previewKey = nextKey;

		if (!currentBaseHash || !currentOverlayHash) {
			cleanupPreview();
			previewState = 'missing';
			return;
		}

		void loadPreview(currentBaseHash, currentOverlayHash);
	});

	onDestroy(() => {
		previewRunId += 1;
		cleanupPreview();
	});
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
		<WorkspaceSidebar side="left" width={308} bind:open={leftPanelOpen}>
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
								{@const groupBaseImage = imageById.get(group.baseImageId)}
								{@const stats = groupStats.get(group.id)}

								<GroupListItem
									{group}
									selected={group.id === selectedGroupId}
									baseImageContentHash={groupBaseImage?.contentHash ?? null}
									alignmentCount={stats?.alignmentCount ?? 0}
									annotationCount={stats?.annotationCount ?? 0}
									onSelect={selectGroup}
								/>
							{/each}
						</div>
					{/if}
				</div>

				<div class="sidebar-footer">
					<div class="footer-stats">
						<span>{images.length} images</span>
						<span>{groups.length} groups</span>
						<span>{alignments.length} alignments</span>
						<span>{annotations.length} annotations</span>
					</div>
				</div>
			</div>
		</WorkspaceSidebar>

		<main class="main">
			{#if selectedGroup}
				<section class="group-header-card">
					<div class="group-line">
						<div>
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

						{#if referenceImage && comparedImage}
							<div class="pair-badge">
								<div class="pair-badge-label">Active pair</div>
								<div class="pair-badge-value">
									{getImageTitle(referenceImage)} -> {getImageTitle(comparedImage)}
								</div>
							</div>
						{/if}
					</div>
				</section>

				<div class="main-body">
					<section class="stage-column">
						<div class="workflow-grid">
							<article class="workflow-card">
								<div class="card-kicker">Step 1</div>
								<h3>Base image</h3>
								<p>
									The base image defines the default reference frame for group alignment and
									annotation.
								</p>

								{#if baseImage}
									<div class="selection-summary">
										<div class="selection-label">Current base</div>
										<div class="selection-value">{getImageTitle(baseImage)}</div>
									</div>
								{/if}

								{#if comparedImage && comparedImage.id !== selectedGroup.baseImageId}
									<button
										type="button"
										class="action-button"
										disabled={selectedGroupAlignments.length > 0}
										onclick={setSelectedAsBaseImage}
									>
										Set "{getImageTitle(comparedImage)}" as base
									</button>
									<div class="helper-copy">
										{#if selectedGroupAlignments.length > 0}
											Base changes are disabled once alignments exist for the group.
										{:else}
											Use the image selected in the filmstrip as the new base before alignment work starts.
										{/if}
									</div>
								{:else}
									<div class="helper-copy">Select a different image below if you want to promote it to the base.</div>
								{/if}
							</article>

							<article class="workflow-card">
								<div class="card-kicker">Step 2</div>
								<h3>Comparison pair</h3>
								<p>
									Comparisons are always represented as a reference image plus a compared image. That
									pair drives both alignment and annotation.
								</p>

								<div class="field-grid">
									<label class="field">
										<span>Reference image</span>
										<select
											value={referenceImage?.id ?? ''}
											onchange={(event) => selectReferenceImage((event.currentTarget as HTMLSelectElement).value)}
										>
											{#each selectedGroupImages as image (image.id)}
												<option value={image.id}>{getImageTitle(image)}</option>
											{/each}
										</select>
									</label>

									<label class="field">
										<span>Compared image</span>
										<select
											value={comparedImage?.id ?? ''}
											onchange={(event) => selectComparedImage((event.currentTarget as HTMLSelectElement).value)}
										>
											{#each selectedGroupImages as image (image.id)}
												<option value={image.id} disabled={image.id === referenceImage?.id}>
													{getImageTitle(image)}
												</option>
											{/each}
										</select>
									</label>
								</div>

								<div class="pair-note">
									Selecting an annotation from the right sidebar restores this pair automatically, so
									non-base image comparisons stay explicit.
								</div>
							</article>

							<article class="workflow-card">
								<div class="card-kicker">Step 3</div>
								<h3>Alignment and annotations</h3>
								<p>
									Choose an approach, review the result, then confirm it. Confirmed base comparisons can
									move directly into annotation.
								</p>

								<div class="field-grid compact">
									<label class="field">
										<span>Approach</span>
										<select
											value={alignmentApproach}
											onchange={(event) =>
												(alignmentApproach = (event.currentTarget as HTMLSelectElement).value as
													typeof alignmentApproach)}
										>
											<option value="auto">Automatic alignment</option>
											<option value="feature">Feature matching</option>
											<option value="manual">Manual alignment</option>
										</select>
									</label>

									<div class="status-stack">
										<div class={`status-pill ${getStatusTone(activeAlignment?.status ?? null)}`}>
											{activeAlignment
												? activeAlignment.status === 'confirmed'
													? 'Alignment confirmed'
													: 'Alignment draft'
												: referenceImage?.id === selectedGroup.baseImageId && comparedImage?.id !== selectedGroup.baseImageId
													? 'No stored alignment yet'
													: 'Ad hoc comparison'}
										</div>

										<div class="helper-copy">
											{#if activeAlignment}
												Schema: {activeAlignment.schemaId} · Model: {activeAlignment.result.transformModel}
											{:else if referenceImage?.id !== selectedGroup.baseImageId}
												Comparing two non-base images. Use this pair for review and annotation context.
											{:else}
												Run and lock alignment here once the alignment engine is connected to this view.
											{/if}
										</div>
									</div>
								</div>

								<button
									type="button"
									class="action-button"
									disabled={!activeAlignment || activeAlignment.status === 'confirmed'}
									onclick={confirmAlignment}
								>
									Confirm selected alignment
								</button>

								<div class="helper-copy">
									{activePairAnnotations.length} annotations currently match this pair.
									{#if annotationConfig}
										New annotations will use the active project schema.
									{/if}
								</div>
							</article>
						</div>

						<section class="viewer-card">
							<div class="viewer-card-head">
								<div>
									<div class="viewer-title">
										{referenceImage ? getImageTitle(referenceImage) : 'Reference image'}
										<span class="viewer-separator">-></span>
										{comparedImage ? getImageTitle(comparedImage) : 'Compared image'}
									</div>
									<div class="viewer-subtitle">
										{referenceImage ? getImageSourceKind(referenceImage) : 'Unknown'} reference ·
										{comparedImage ? getImageSourceKind(comparedImage) : 'Unknown'} comparison
									</div>
								</div>

								<div class="viewer-meta">
									<span>{activePairAnnotations.length} pair annotations</span>
									{#if selectedAnnotation}
										<span>Selected: {selectedAnnotation.schemaId}</span>
									{/if}
								</div>
							</div>

							<div class="viewer-shell">
								{#if previewState === 'ready' && baseUrl && overlayUrl}
									{#key `${baseUrl}:${overlayUrl}:${viewerRefreshKey}:${referenceImage?.id ?? ''}:${comparedImage?.id ?? ''}`}
										<AnnotatedImageCompareViewer
											imageUrl={baseUrl}
											overlayUrl={overlayUrl}
											session={compareSession}
											initialViewState={{
												overlayOpacity: 0.6,
												annotationsVisible: true,
												annotationMode: 'pan',
												readingFocusEnabled: false,
												readingFocusClearCenterPct: 30,
												readingFocusOpacity: 0.35,
												readingFocusBlurPx: 3
											}}
											refreshKey={viewerRefreshKey}
										/>
									{/key}
								{:else if previewState === 'loading'}
									<div class="viewer-empty">
										<div class="viewer-empty-card">
											<h3>Loading comparison</h3>
											<p>Preparing the selected pair for review.</p>
										</div>
									</div>
								{:else}
									<div class="viewer-empty">
										<div class="viewer-empty-card">
											<h3>No preview available</h3>
											<p>The selected images could not be prepared for comparison.</p>
										</div>
									</div>
								{/if}
							</div>
						</section>

						<section class="filmstrip-card">
							<div class="filmstrip-head">
								<div>
									<div class="card-kicker">Group images</div>
									<h3>Bottom filmstrip</h3>
								</div>
								<div class="helper-copy">Select the compared image here. Use the compare controls above to change the reference image.</div>
							</div>

							<div class="filmstrip" aria-label="Images in selected group">
								{#each selectedGroupImages as image (image.id)}
									{@const alignment = alignmentByComparedId.get(image.id)}
									<button
										type="button"
										class="filmstrip-item"
										class:selected={image.id === comparedImage?.id}
										class:reference={image.id === referenceImage?.id}
										class:base={image.id === selectedGroup.baseImageId}
										onclick={() => selectComparedImage(image.id)}
									>
										<div class="filmstrip-thumb">
											<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
										</div>
										<div class="filmstrip-copy">
											<div class="filmstrip-title">{getImageTitle(image)}</div>
											<div class="filmstrip-subline">
												{image.dimensions.width} × {image.dimensions.height}
											</div>
											<div class="filmstrip-tags">
												{#if image.id === selectedGroup.baseImageId}
													<span class="mini-tag base">Base</span>
												{/if}
												{#if image.id === referenceImage?.id}
													<span class="mini-tag ref">Reference</span>
												{/if}
												{#if image.id === comparedImage?.id}
													<span class="mini-tag current">Compared</span>
												{/if}
												{#if alignment}
													<span class={`mini-tag ${alignment.status === 'confirmed' ? 'ok' : 'draft'}`}>
														{alignment.status}
													</span>
												{/if}
											</div>
										</div>
									</button>
								{/each}
							</div>
						</section>
					</section>

					<WorkspaceSidebar side="right" width={338} bind:open={rightPanelOpen}>
						{#snippet header()}
							<div class="right-sidebar-header">
								<div>
									<div class="right-sidebar-title">Annotation sidebar</div>
									<div class="right-sidebar-subtitle">
										All group annotations, with the active pair surfaced first
									</div>
								</div>
							</div>
						{/snippet}

						<GroupAnnotationsPanel
							annotations={orderedGroupAnnotations}
							selectedAnnotationId={selectedAnnotationId}
							activePairImageIds={activePairImageIds}
							imageTitleById={Object.fromEntries(imageTitleById)}
							{geometrySummary}
							onSelect={selectAnnotation}
						/>
					</WorkspaceSidebar>
				</div>
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
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background:
			radial-gradient(circle at top right, rgba(251, 191, 36, 0.08), transparent 24%),
			linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.98));
	}

	.sidebar-shell {
		height: 100%;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: rgba(255, 255, 255, 0.92);
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.sidebar-header {
		flex: 0 0 auto;
		padding: 0.7rem 0.75rem 0.6rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
	}

	.project-line,
	.group-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
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
		padding: 0 0.4rem;
	}

	.sidebar-footer {
		flex: 0 0 auto;
		padding: 0.55rem 0.75rem;
		border-top: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
		font-size: 0.72rem;
		color: #64748b;
		line-height: 1.4;
	}

	.footer-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.45rem;
	}

	.group-list {
		display: flex;
		flex-direction: column;
	}

	.main {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.group-header-card {
		flex: 0 0 auto;
		padding: 0.9rem 1rem 0.75rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
	}

	.group-name {
		font-weight: 700;
		font-size: 1rem;
		color: #111827;
		min-width: 0;
	}

	.group-summary,
	.group-header-sub,
	.helper-copy,
	.viewer-subtitle,
	.right-sidebar-subtitle {
		color: #64748b;
		font-size: 0.76rem;
	}

	.group-header-sub {
		margin-left: 0.3rem;
	}

	.main-body {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
	}

	.stage-column {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 1rem;
		padding: 1rem;
	}

	.workflow-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.workflow-card,
	.viewer-card,
	.filmstrip-card {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		box-shadow:
			0 18px 38px rgba(15, 23, 42, 0.05),
			0 4px 14px rgba(15, 23, 42, 0.04);
	}

	.workflow-card {
		padding: 1rem;
	}

	.card-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b45309;
	}

	.workflow-card h3,
	.filmstrip-card h3,
	.viewer-empty-card h3 {
		margin: 0.28rem 0 0;
		font-size: 1rem;
		color: #0f172a;
	}

	.workflow-card p,
	.viewer-empty-card p {
		margin: 0.45rem 0 0;
		font-size: 0.84rem;
		line-height: 1.45;
		color: #334155;
	}

	.selection-summary {
		margin-top: 0.8rem;
		padding: 0.75rem 0.85rem;
		border-radius: 14px;
		background: rgba(248, 250, 252, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	.selection-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
	}

	.selection-value {
		margin-top: 0.18rem;
		font-size: 0.9rem;
		font-weight: 700;
		color: #111827;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.8rem;
	}

	.field-grid.compact {
		align-items: start;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field span {
		font-size: 0.76rem;
		font-weight: 700;
		color: #334155;
	}

	.field select {
		appearance: none;
		width: 100%;
		border: 1px solid rgba(148, 163, 184, 0.38);
		border-radius: 12px;
		background: #fff;
		padding: 0.7rem 0.8rem;
		font-size: 0.86rem;
		color: #111827;
	}

	.pair-note {
		margin-top: 0.8rem;
		padding: 0.7rem 0.8rem;
		border-radius: 14px;
		background: rgba(254, 249, 195, 0.5);
		color: #713f12;
		font-size: 0.77rem;
		line-height: 1.4;
	}

	.status-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.status-pill,
	.mini-tag,
	.pair-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-weight: 700;
		white-space: nowrap;
	}

	.status-pill {
		padding: 0.48rem 0.7rem;
		font-size: 0.76rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(226, 232, 240, 0.65);
		color: #475569;
	}

	.status-pill.confirmed {
		background: rgba(16, 185, 129, 0.12);
		color: #047857;
	}

	.status-pill.draft {
		background: rgba(245, 158, 11, 0.12);
		color: #b45309;
	}

	.action-button {
		margin-top: 0.85rem;
		border: none;
		border-radius: 12px;
		background: linear-gradient(180deg, #0f766e, #115e59);
		color: #fff;
		font-weight: 700;
		padding: 0.78rem 0.95rem;
		cursor: pointer;
	}

	.action-button:disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}

	.helper-copy {
		margin-top: 0.55rem;
		line-height: 1.45;
	}

	.viewer-card {
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.viewer-card-head,
	.filmstrip-head,
	.right-sidebar-header {
		padding: 0.95rem 1rem 0.75rem;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.viewer-title,
	.right-sidebar-title {
		font-size: 0.96rem;
		font-weight: 700;
		color: #0f172a;
	}

	.viewer-separator {
		margin: 0 0.45rem;
		color: #94a3b8;
	}

	.viewer-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.35rem 0.55rem;
		font-size: 0.74rem;
		color: #64748b;
	}

	.viewer-shell {
		flex: 1 1 auto;
		min-height: 24rem;
		height: 100%;
		overflow: hidden;
		border-top: 1px solid rgba(15, 23, 42, 0.06);
		background:
			radial-gradient(circle at top, rgba(14, 116, 144, 0.08), transparent 24%),
			linear-gradient(180deg, #eef2ff, #f8fafc);
	}

	.viewer-empty {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.viewer-empty-card {
		max-width: 24rem;
		text-align: center;
		padding: 1.4rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.86);
		border: 1px solid rgba(15, 23, 42, 0.08);
	}

	.filmstrip-card {
		padding: 0 0 0.85rem;
	}

	.filmstrip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(190px, 220px);
		gap: 0.8rem;
		overflow-x: auto;
		padding: 0 1rem;
	}

	.filmstrip-item {
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 16px;
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		padding: 0.75rem;
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		gap: 0.75rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
	}

	.filmstrip-item.selected {
		border-color: rgba(37, 99, 235, 0.34);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.filmstrip-item.reference {
		box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.3);
	}

	.filmstrip-item.base {
		border-left: 4px solid #2563eb;
	}

	.filmstrip-thumb {
		width: 72px;
		height: 72px;
		border-radius: 12px;
		background:
			linear-gradient(135deg, rgba(226, 232, 240, 0.9), rgba(241, 245, 249, 0.98)),
			repeating-linear-gradient(
				45deg,
				rgba(148, 163, 184, 0.1),
				rgba(148, 163, 184, 0.1) 6px,
				rgba(255, 255, 255, 0.7) 6px,
				rgba(255, 255, 255, 0.7) 12px
			);
		border: 1px solid rgba(15, 23, 42, 0.08);
	}

	.filmstrip-copy {
		min-width: 0;
	}

	.filmstrip-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: #111827;
	}

	.filmstrip-subline {
		margin-top: 0.2rem;
		font-size: 0.72rem;
		color: #64748b;
	}

	.filmstrip-tags {
		margin-top: 0.45rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.mini-tag {
		padding: 0.2rem 0.45rem;
		font-size: 0.67rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(241, 245, 249, 0.92);
		color: #475569;
	}

	.mini-tag.base {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.mini-tag.ref {
		background: rgba(245, 158, 11, 0.12);
		color: #b45309;
	}

	.mini-tag.current {
		background: rgba(15, 118, 110, 0.12);
		color: #0f766e;
	}

	.mini-tag.ok {
		background: rgba(16, 185, 129, 0.12);
		color: #047857;
	}

	.mini-tag.draft {
		background: rgba(245, 158, 11, 0.12);
		color: #b45309;
	}

	.pair-badge {
		flex-direction: column;
		align-items: flex-end;
		padding: 0.6rem 0.8rem;
		background: rgba(255, 247, 237, 0.88);
		border: 1px solid rgba(245, 158, 11, 0.16);
		border-radius: 18px;
	}

	.pair-badge-label {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #b45309;
	}

	.pair-badge-value {
		margin-top: 0.18rem;
		font-size: 0.82rem;
		color: #7c2d12;
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

	code {
		word-break: break-word;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	@media (max-width: 1280px) {
		.workflow-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 960px) {
		.main-body {
			flex-direction: column;
		}

		.stage-column {
			grid-template-rows: auto minmax(26rem, 1fr) auto;
		}

		.field-grid {
			grid-template-columns: 1fr;
		}

		.group-line,
		.viewer-card-head,
		.filmstrip-head {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
