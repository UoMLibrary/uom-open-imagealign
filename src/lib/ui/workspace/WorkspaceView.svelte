<script lang="ts">
	import { onDestroy } from 'svelte';

	import WorkspaceSidebar from '$lib/ui/workspace/WorkspaceSidebar.svelte';
	import GroupListItem from '$lib/ui/workspace/GroupListItem.svelte';
	import GroupAnnotationsPanel from '$lib/ui/workspace/GroupAnnotationsPanel.svelte';
	import ImageCompareViewer from '$lib/ui/compare/ImageCompareViewer.svelte';
	import AnnotatedImageCompareViewer from '$lib/ui/compare/AnnotatedImageCompareViewer.svelte';
	import { createAnnotationCompareSession } from '$lib/ui/compare/annotationCompareSession';
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	import { getDerivedUrl } from '$lib/images/derivationService';
	import { getDerivationCacheKey } from '$lib/images/derivationState.svelte';
	import { mutateProject, projectState } from '$lib/project/projectStore.svelte';

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

	let imageById = $derived.by(() => {
		const map = new Map<string, (typeof images)[number]>();
		for (const image of images) map.set(image.id, image);
		return map;
	});

	let imageTitleById = $derived.by(() => {
		const map = new Map<string, string>();
		for (const image of images) map.set(image.id, getImageTitle(image));
		return map;
	});

	let groupStats = $derived.by(() => {
		const map = new Map<string, { alignmentCount: number; annotationCount: number }>();

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

	let baseImage = $derived(
		selectedGroup ? (imageById.get(selectedGroup.baseImageId) ?? null) : null
	);

	let hasBaseImage = $derived(Boolean(baseImage && selectedGroup?.baseImageId));

	let selectedGroupAlignments = $derived.by(() => {
		if (!selectedGroup) return [];
		return alignments.filter((alignment) => alignment.groupId === selectedGroup.id);
	});

	let confirmedAlignments = $derived.by(() =>
		selectedGroupAlignments.filter((alignment) => alignment.status === 'confirmed')
	);

	let alignedImageIds = $derived.by(() => {
		const ids = new Set<string>();
		if (selectedGroup?.baseImageId) ids.add(selectedGroup.baseImageId);
		for (const alignment of confirmedAlignments) ids.add(alignment.comparedImageId);
		return ids;
	});

	let alignedImages = $derived.by(() =>
		selectedGroupImages.filter((image) => alignedImageIds.has(image.id))
	);

	let canAnnotate = $derived(alignedImages.length >= 2);

	let selectedGroupAnnotations = $derived.by(() => {
		if (!selectedGroup) return [];
		return annotations.filter((annotation) => annotation.groupId === selectedGroup.id);
	});

	let isBaseSelectionPhase = $derived(!hasBaseImage);

	let alignmentByComparedId = $derived.by(() => {
		const map = new Map<string, (typeof alignments)[number]>();
		for (const alignment of selectedGroupAlignments) map.set(alignment.comparedImageId, alignment);
		return map;
	});

	let alignmentTargetImage = $derived.by(() => {
		if (!selectedGroup || selectedGroupImages.length === 0) return null;

		const validImages = selectedGroupImages.filter(
			(image) => image.id !== selectedGroup.baseImageId
		);
		if (validImages.length === 0) return null;

		const selected = validImages.find((image) => image.id === selectedImageId);
		return selected ?? validImages[0] ?? null;
	});

	let activeAlignment = $derived(
		alignmentTargetImage ? (alignmentByComparedId.get(alignmentTargetImage.id) ?? null) : null
	);

	let selectedImage = $derived(
		selectedImageId
			? (selectedGroupImages.find((image) => image.id === selectedImageId) ?? null)
			: null
	);

	let orderedStripImages = $derived.by(() => {
		if (!selectedGroup) return selectedGroupImages;
		if (!selectedGroup.baseImageId) return selectedGroupImages;

		return [...selectedGroupImages].sort((a, b) => {
			if (a.id === selectedGroup.baseImageId) return -1;
			if (b.id === selectedGroup.baseImageId) return 1;
			return 0;
		});
	});

	let confirmedAlignmentIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const alignment of confirmedAlignments) {
			ids.add(alignment.comparedImageId);
		}
		return ids;
	});

	let referenceImage = $derived.by(() => {
		if (!selectedGroup) return null;
		const pool = canAnnotate ? alignedImages : selectedGroupImages;
		const fallbackId = selectedGroup.baseImageId || pool[0]?.id || null;
		const targetId = referenceImageId ?? fallbackId;
		return (
			pool.find((image) => image.id === targetId) ??
			(fallbackId ? (imageById.get(fallbackId) ?? null) : null)
		);
	});

	let comparedImage = $derived.by(() => {
		if (canAnnotate) {
			const selected = alignedImages.find((image) => image.id === selectedImageId);
			if (selected && selected.id !== referenceImage?.id) return selected;
			return alignedImages.find((image) => image.id !== referenceImage?.id) ?? null;
		}

		return alignmentTargetImage;
	});

	function annotationIncludesPair(
		annotation: (typeof annotations)[number],
		anchorId: string | null,
		comparedId: string | null
	): boolean {
		if (!anchorId || !comparedId) return false;
		if (annotation.anchorImageId === anchorId && annotation.targetImageIds.includes(comparedId))
			return true;

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

	let activePairImageIds = $derived.by(() =>
		Array.from(new Set([referenceImage?.id, comparedImage?.id].filter(Boolean) as string[]))
	);

	const compareSession = createAnnotationCompareSession({
		annotations: []
	});

	$effect(() => {
		compareSession.setAnnotations(activePairAnnotations);

		if (
			selectedAnnotationId &&
			activePairAnnotations.some((annotation) => annotation.id === selectedAnnotationId)
		) {
			compareSession.selectAnnotation(selectedAnnotationId);
			return;
		}

		compareSession.selectAnnotation(null);
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

		if (!selectedImageId || !selectedGroup.imageIds.includes(selectedImageId)) {
			selectedImageId =
				selectedGroup.imageIds.find((imageId) => imageId !== selectedGroup.baseImageId) ??
				selectedGroup.baseImageId ??
				null;
		}
	});

	$effect(() => {
		if (!selectedGroup) return;

		const referencePool = canAnnotate ? alignedImages : selectedGroupImages;
		if (referencePool.length === 0) {
			referenceImageId = null;
			return;
		}

		const fallbackId = selectedGroup.baseImageId || referencePool[0]?.id || null;
		const valid = referenceImageId && referencePool.some((image) => image.id === referenceImageId);
		if (!valid) {
			referenceImageId = fallbackId;
		}
	});

	$effect(() => {
		if (!selectedAnnotationId) return;
		if (selectedGroupAnnotations.some((annotation) => annotation.id === selectedAnnotationId))
			return;
		selectedAnnotationId = null;
	});

	function selectGroup(groupId: string) {
		selectedGroupId = groupId;
		selectedAnnotationId = null;
	}

	function selectImage(imageId: string) {
		selectedImageId = imageId;
		selectedAnnotationId = null;
	}

	function selectReferenceImage(imageId: string) {
		referenceImageId = imageId;
		selectedAnnotationId = null;

		if (selectedImageId === imageId) {
			const fallback = alignedImages.find((image) => image.id !== imageId) ?? null;
			selectedImageId = fallback?.id ?? selectedImageId;
		}
	}

	function selectAnnotation(annotationId: string) {
		const annotation = selectedGroupAnnotations.find((item) => item.id === annotationId);
		if (!annotation) return;

		selectedAnnotationId = annotation.id;
		referenceImageId = annotation.anchorImageId;

		const comparedId =
			annotation.targetImageIds.find((imageId) => imageId !== annotation.anchorImageId) ??
			annotation.targetImageIds[0] ??
			null;

		if (comparedId) selectedImageId = comparedId;
		rightPanelOpen = true;
	}

	function setImageAsBase(imageId: string) {
		if (!selectedGroup) return;
		const nextBaseImage = selectedGroupImages.find((image) => image.id === imageId) ?? null;
		if (!nextBaseImage) return;
		if (
			!window.confirm(`Set "${getImageTitle(nextBaseImage)}" as the base image for this group?`)
		) {
			return;
		}

		mutateProject((nextProject) => {
			const targetGroup = nextProject.groups.find((group) => group.id === selectedGroup.id);
			if (!targetGroup) return;
			targetGroup.baseImageId = nextBaseImage.id;
		});

		referenceImageId = nextBaseImage.id;
		selectedImageId = nextBaseImage.id;
		selectedAnnotationId = null;
	}

	function setSelectedAsBaseImage() {
		if (!alignmentTargetImage) return;
		setImageAsBase(alignmentTargetImage.id);
	}

	function confirmAlignment() {
		if (!activeAlignment || activeAlignment.status === 'confirmed') return;

		mutateProject((nextProject) => {
			const alignment = nextProject.alignments.find((item) => item.id === activeAlignment.id);
			if (!alignment) return;
			alignment.status = 'confirmed';
		});
	}

	function resetGroupWorkflow() {
		if (!selectedGroup) return;

		const label = getGroupLabel(selectedGroup);
		const confirmed = window.confirm(
			`Reset all workflow for "${label}"? This will clear the group's alignments and annotations and restore the first image as the base.`
		);

		if (!confirmed) return;

		mutateProject((nextProject) => {
			nextProject.alignments = nextProject.alignments.filter(
				(alignment) => alignment.groupId !== selectedGroup.id
			);
			nextProject.annotations = nextProject.annotations.filter(
				(annotation) => annotation.groupId !== selectedGroup.id
			);

			const targetGroup = nextProject.groups.find((group) => group.id === selectedGroup.id);
			if (!targetGroup) return;
			targetGroup.baseImageId = targetGroup.imageIds[0];
		});

		selectedAnnotationId = null;
		referenceImageId = selectedGroup.imageIds[0] ?? null;
		selectedImageId = selectedGroup.imageIds[1] ?? selectedGroup.imageIds[0] ?? null;
	}

	function resetBaseSelection() {
		if (!selectedGroup) return;

		const confirmed = window.confirm(
			`Reset the base image for "${getGroupLabel(selectedGroup)}"? This clears the group's alignments and annotations and leaves the group with no base image set.`
		);

		if (!confirmed) return;

		mutateProject((nextProject) => {
			nextProject.alignments = nextProject.alignments.filter(
				(alignment) => alignment.groupId !== selectedGroup.id
			);
			nextProject.annotations = nextProject.annotations.filter(
				(annotation) => annotation.groupId !== selectedGroup.id
			);

			const targetGroup = nextProject.groups.find((group) => group.id === selectedGroup.id);
			if (!targetGroup) return;
			targetGroup.baseImageId = '';
		});

		selectedImageId = selectedGroup.imageIds[0] ?? null;
		referenceImageId = null;
		selectedAnnotationId = null;
	}

	function resetSelectedImageWorkflow() {
		if (!selectedGroup || !alignmentTargetImage) return;

		const confirmed = window.confirm(
			`Reset the alignment workflow for "${getImageTitle(alignmentTargetImage)}"? This clears its alignment record and annotations involving this image.`
		);

		if (!confirmed) return;

		const imageId = alignmentTargetImage.id;
		const groupId = selectedGroup.id;

		mutateProject((nextProject) => {
			nextProject.alignments = nextProject.alignments.filter(
				(alignment) => !(alignment.groupId === groupId && alignment.comparedImageId === imageId)
			);

			nextProject.annotations = nextProject.annotations.filter((annotation) => {
				if (annotation.groupId !== groupId) return true;
				const relatedIds = new Set([annotation.anchorImageId, ...annotation.targetImageIds]);
				return !relatedIds.has(imageId);
			});
		});

		selectedAnnotationId = null;
		if (referenceImageId === imageId) {
			referenceImageId = selectedGroup.baseImageId;
		}
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

	let viewerMode = $derived.by(() => {
		if (isBaseSelectionPhase) return 'base-selection';
		if (!hasBaseImage) return 'base';
		if (canAnnotate && referenceImage && comparedImage) return 'annotate';
		if (baseImage && alignmentTargetImage) return 'align';
		return 'base';
	});

	let previewBaseImage = $derived.by(() => {
		if (viewerMode === 'base-selection')
			return selectedImage ?? baseImage ?? selectedGroupImages[0] ?? null;
		if (viewerMode === 'annotate') return referenceImage;
		if (viewerMode === 'align') return baseImage;
		return alignmentTargetImage ?? baseImage ?? selectedGroupImages[0] ?? null;
	});

	let previewOverlayImage = $derived.by(() => {
		if (viewerMode === 'annotate') return comparedImage;
		if (viewerMode === 'align') return alignmentTargetImage;
		return null;
	});

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

	async function loadPreview(nextBaseHash: string, nextOverlayHash: string | null) {
		const id = ++previewRunId;

		cleanupPreview();
		previewState = 'loading';

		try {
			const baseRes = await getDerivedUrl(nextBaseHash, 'work');
			let overlayRes: Awaited<ReturnType<typeof getDerivedUrl>> | null = null;

			if (nextOverlayHash) {
				overlayRes = await getDerivedUrl(nextOverlayHash, 'work');
			}

			if (id !== previewRunId) {
				baseRes.release();
				overlayRes?.release();
				return;
			}

			baseRelease = baseRes.release;
			overlayRelease = overlayRes?.release ?? null;
			baseUrl = baseRes.url;
			overlayUrl = overlayRes?.url ?? null;
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
		const currentBaseHash = previewBaseImage?.contentHash ?? '';
		const currentOverlayHash = previewOverlayImage?.contentHash ?? null;
		const nextKey = [
			currentBaseHash ? getDerivationCacheKey(currentBaseHash) : '',
			currentOverlayHash ? getDerivationCacheKey(currentOverlayHash) : '',
			viewerMode,
			previewBaseImage?.id ?? '',
			previewOverlayImage?.id ?? ''
		].join('|');

		if (nextKey === previewKey) return;
		previewKey = nextKey;

		if (!currentBaseHash) {
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
		<p>Open a project, create one from a folder, or import from a spreadsheet to see it here.</p>
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
								{@const groupPreviewImage =
									imageById.get(group.baseImageId) ??
									(group.imageIds[0] ? imageById.get(group.imageIds[0]) : null)}
								{@const stats = groupStats.get(group.id)}

								<GroupListItem
									{group}
									selected={group.id === selectedGroupId}
									baseImageContentHash={groupPreviewImage?.contentHash ?? null}
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
						<div class="group-heading">
							<div class="group-name">Group: {getGroupLabel(selectedGroup)}</div>
							<div class="group-summary">
								{selectedGroup.imageIds.length} images · {selectedGroupAlignments.length} alignments ·
								{selectedGroupAnnotations.length} annotations
							</div>
						</div>

						<div class="phase-pill">
							{viewerMode === 'annotate'
								? 'Annotate'
								: viewerMode === 'align'
									? 'Align'
									: 'Choose base'}
						</div>
					</div>
				</section>

				<div class="main-body">
					<section class="stage-column" class:base-selection-layout={isBaseSelectionPhase}>
						{#if !isBaseSelectionPhase}
							<section class="toolbar-card">
								<div class="toolbar-grid">
									<div class="mini-panel">
										<div class="mini-kicker">Alignment</div>
										<div class="mini-title">
											{alignmentTargetImage
												? getImageTitle(alignmentTargetImage)
												: 'No target image'}
										</div>
										<div class="mini-copy">
											{#if activeAlignment}
												{activeAlignment.status === 'confirmed' ? 'Confirmed' : 'Draft'} · {activeAlignment.schemaId}
											{:else}
												Select an image from the filmstrip to work on its alignment against the
												base.
											{/if}
										</div>

										<div class="field-row">
											<label class="field">
												<span>Approach</span>
												<select
													value={alignmentApproach}
													onchange={(event) =>
														(alignmentApproach = (event.currentTarget as HTMLSelectElement)
															.value as typeof alignmentApproach)}
												>
													<option value="auto">Automatic</option>
													<option value="feature">Feature match</option>
													<option value="manual">Manual</option>
												</select>
											</label>
										</div>

										<div class="mini-actions">
											<button
												type="button"
												class="action-button"
												disabled={!activeAlignment || activeAlignment.status === 'confirmed'}
												onclick={confirmAlignment}
											>
												Confirm alignment
											</button>

											{#if alignmentTargetImage}
												<button
													type="button"
													class="ghost-button"
													onclick={resetSelectedImageWorkflow}
												>
													Reset this image's workflow
												</button>
											{/if}
										</div>

										<div class="mini-note">
											Changing this image's alignment clears annotations that involve it so we do
											not leave stale cross-image comparisons behind.
										</div>
									</div>

									{#if canAnnotate}
										<div class="mini-panel">
											<div class="mini-kicker">Compare and annotate</div>
											<div class="mini-title">
												{referenceImage ? getImageTitle(referenceImage) : 'Reference'} -> {comparedImage
													? getImageTitle(comparedImage)
													: 'Compared'}
											</div>
											<div class="mini-copy">
												Only confirmed alignments are offered here, so pairwise comparison stays on
												stable geometry.
											</div>

											<div class="field-row double">
												<label class="field">
													<span>Reference</span>
													<select
														value={referenceImage?.id ?? ''}
														onchange={(event) =>
															selectReferenceImage(
																(event.currentTarget as HTMLSelectElement).value
															)}
													>
														{#each alignedImages as image (image.id)}
															<option value={image.id}>{getImageTitle(image)}</option>
														{/each}
													</select>
												</label>

												<label class="field">
													<span>Compared</span>
													<select
														value={comparedImage?.id ?? ''}
														onchange={(event) =>
															selectImage((event.currentTarget as HTMLSelectElement).value)}
													>
														{#each alignedImages as image (image.id)}
															<option value={image.id} disabled={image.id === referenceImage?.id}>
																{getImageTitle(image)}
															</option>
														{/each}
													</select>
												</label>
											</div>

											<div class="mini-note">
												Selecting an annotation in the right sidebar restores the same pair.
											</div>
										</div>
									{/if}
								</div>
							</section>
						{/if}

						<section class="viewer-card" class:viewer-stage-only={isBaseSelectionPhase}>
							{#if !isBaseSelectionPhase}
								<div class="viewer-card-head">
									<div>
										<div class="viewer-title">
											{#if viewerMode === 'annotate' && referenceImage && comparedImage}
												{getImageTitle(referenceImage)} -> {getImageTitle(comparedImage)}
											{:else if viewerMode === 'align' && baseImage && alignmentTargetImage}
												{getImageTitle(baseImage)} -> {getImageTitle(alignmentTargetImage)}
											{:else if previewBaseImage}
												{getImageTitle(previewBaseImage)}
											{:else}
												Viewer
											{/if}
										</div>
										<div class="viewer-subtitle">
											{#if viewerMode === 'annotate'}
												Annotated comparison viewer
											{:else if viewerMode === 'align'}
												Simple compare viewer for alignment review
											{:else}
												Base-image preview
											{/if}
										</div>
									</div>

									<div class="viewer-meta">
										{#if viewerMode === 'annotate'}
											<span>{activePairAnnotations.length} pair annotations</span>
										{:else if viewerMode === 'align' && activeAlignment}
											<span>{activeAlignment.status}</span>
											<span>{activeAlignment.result.transformModel}</span>
										{/if}
									</div>
								</div>
							{/if}

							<div class="viewer-shell">
								{#if previewState === 'ready' && baseUrl}
									{#key `${baseUrl}:${overlayUrl ?? ''}:${viewerRefreshKey}:${viewerMode}`}
										{#if viewerMode === 'annotate' && overlayUrl}
											<AnnotatedImageCompareViewer
												imageUrl={baseUrl}
												{overlayUrl}
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
										{:else}
											<ImageCompareViewer
												imageUrl={baseUrl}
												{overlayUrl}
												showHomeControl={true}
												showZoomControl={true}
												wheelAdjustOpacity={viewerMode !== 'base-selection'}
												enableHoldShowBasePreview={viewerMode !== 'base-selection'}
												refreshKey={viewerRefreshKey}
											/>
										{/if}
									{/key}
								{:else if previewState === 'loading'}
									<div class="viewer-empty">
										<div class="viewer-empty-card">
											<h3>Loading viewer</h3>
											<p>Preparing the current image selection.</p>
										</div>
									</div>
								{:else}
									<div class="viewer-empty">
										<div class="viewer-empty-card">
											<h3>No preview available</h3>
											<p>Select a group image to continue.</p>
										</div>
									</div>
								{/if}
							</div>
						</section>

						<section class="filmstrip-card filmstrip-footer">
							<div class="filmstrip-head" class:filmstrip-head-flat={isBaseSelectionPhase}>
								<div>
									<div class="filmstrip-title-bar">Group Images</div>
								</div>
								<button
									type="button"
									class="ghost-button danger compact"
									onclick={resetBaseSelection}
								>
									Reset base image
								</button>
							</div>

							<div
								class="filmstrip"
								class:filmstrip-flat={isBaseSelectionPhase}
								aria-label="Images in selected group"
							>
								{#each orderedStripImages as image (image.id)}
									{@const alignment = alignmentByComparedId.get(image.id)}
									{#if isBaseSelectionPhase}
										<div
											class="filmstrip-item filmstrip-item-flat"
											class:selected={image.id === selectedImageId}
											class:base={image.id === selectedGroup.baseImageId}
										>
											<button
												type="button"
												class="filmstrip-select"
												onclick={() => selectImage(image.id)}
											>
												<div class="filmstrip-thumb">
													<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
												</div>

												<div class="filmstrip-copy">
													<div class="filmstrip-title">{getImageTitle(image)}</div>
													<div class="filmstrip-subline">
														{getImageSourceKind(image)} · {image.dimensions.width} × {image
															.dimensions.height}
													</div>
												</div>
											</button>

											<div class="filmstrip-actions">
												<button
													type="button"
													class="inline-action"
													disabled={image.id === selectedGroup.baseImageId}
													onclick={() => {
														selectImage(image.id);
														setImageAsBase(image.id);
													}}
												>
													{image.id === selectedGroup.baseImageId
														? 'Base image'
														: 'Set as base image'}
												</button>
											</div>
										</div>
									{:else}
										<button
											type="button"
											class="filmstrip-item"
											class:selected={image.id === selectedImageId}
											class:reference={image.id === referenceImage?.id}
											class:annotatable={alignedImageIds.has(image.id)}
											onclick={() => selectImage(image.id)}
										>
											<div class="filmstrip-thumb">
												<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
											</div>

											<div class="filmstrip-copy">
												<div class="filmstrip-title">{getImageTitle(image)}</div>
												<div class="filmstrip-subline">
													{getImageSourceKind(image)} · {image.dimensions.width} × {image.dimensions
														.height}
												</div>
												<div class="filmstrip-tags">
													{#if image.id === selectedGroup.baseImageId}
														<span class="mini-tag base">Base</span>
													{/if}
													{#if image.id === referenceImage?.id && canAnnotate}
														<span class="mini-tag ref">Reference</span>
													{/if}
													{#if image.id === selectedImageId}
														<span class="mini-tag current"
															>{canAnnotate ? 'Compared' : 'Selected'}</span
														>
													{/if}
													{#if image.id !== selectedGroup.baseImageId}
														{#if confirmedAlignmentIds.has(image.id)}
															<span class="mini-tag ok">Aligned</span>
														{:else}
															<span class="mini-tag action">Align image</span>
														{/if}
													{:else if alignment}
														<span
															class={`mini-tag ${alignment.status === 'confirmed' ? 'ok' : 'draft'}`}
														>
															{alignment.status}
														</span>
													{/if}
												</div>
											</div>
										</button>
									{/if}
								{/each}
							</div>
						</section>
					</section>

					{#if canAnnotate}
						<WorkspaceSidebar side="right" width={332} bind:open={rightPanelOpen}>
							{#snippet header()}
								<div class="right-sidebar-header">
									<div>
										<div class="right-sidebar-title">Annotations</div>
										<div class="right-sidebar-subtitle">
											Available once at least two images are on confirmed geometry
										</div>
									</div>
								</div>
							{/snippet}

							<GroupAnnotationsPanel
								annotations={orderedGroupAnnotations}
								{selectedAnnotationId}
								{activePairImageIds}
								imageTitleById={Object.fromEntries(imageTitleById)}
								{geometrySummary}
								onSelect={selectAnnotation}
							/>
						</WorkspaceSidebar>
					{/if}
				</div>
			{:else}
				<div class="empty-state">
					<h2>No group selected</h2>
				</div>
			{/if}
		</main>
	</div>
{/if}

<style>
	.workspace {
		--workspace-header-height: 38px;
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
	}

	.sidebar-header {
		flex: 0 0 auto;
		min-height: var(--workspace-header-height);
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
		display: flex;
		align-items: center;
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

	.project-created,
	.group-summary,
	.mini-copy,
	.mini-note,
	.viewer-subtitle,
	.right-sidebar-subtitle {
		color: #64748b;
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
	}

	.footer-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.45rem;
	}

	.group-list,
	.main {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.main {
		flex: 1 1 auto;
		min-width: 0;
	}

	.group-header-card {
		flex: 0 0 auto;
		min-height: var(--workspace-header-height);
		padding: 0.45rem 1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
		border-left: 1px solid rgba(15, 23, 42, 0.08);
		display: flex;
		align-items: center;
	}

	.group-name {
		font-weight: 700;
		font-size: 0.95rem;
		color: #111827;
	}

	.group-heading {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		min-width: 0;
		flex-wrap: wrap;
	}

	.group-line {
		width: 100%;
	}

	.phase-pill,
	.mini-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-weight: 700;
		white-space: nowrap;
	}

	.phase-pill {
		padding: 0.34rem 0.62rem;
		font-size: 0.72rem;
		line-height: 1;
		background: rgba(245, 158, 11, 0.12);
		color: #92400e;
		flex: 0 0 auto;
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
		gap: 0.8rem;
		padding: 0.9rem;
	}

	.stage-column.base-selection-layout {
		gap: 0;
		padding: 0;
		grid-template-rows: minmax(0, 1fr) auto;
	}

	.toolbar-card,
	.viewer-card,
	.filmstrip-card {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 16px;
		box-shadow:
			0 14px 30px rgba(15, 23, 42, 0.04),
			0 2px 8px rgba(15, 23, 42, 0.03);
	}

	.toolbar-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.7rem;
		padding: 0.8rem;
	}

	.mini-panel {
		padding: 0.85rem;
		border-radius: 14px;
		background: rgba(248, 250, 252, 0.82);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	.mini-kicker {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b45309;
	}

	.mini-title,
	.viewer-title,
	.right-sidebar-title {
		margin-top: 0.22rem;
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
	}

	.mini-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.action-button,
	.ghost-button {
		border-radius: 12px;
		padding: 0.72rem 0.9rem;
		font-weight: 700;
		cursor: pointer;
	}

	.action-button {
		border: none;
		background: linear-gradient(180deg, #0f766e, #115e59);
		color: #fff;
	}

	.action-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ghost-button {
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: #fff;
		color: #334155;
	}

	.ghost-button.danger {
		color: #b91c1c;
		border-color: rgba(239, 68, 68, 0.22);
		background: rgba(254, 242, 242, 0.8);
	}

	.field-row {
		margin-top: 0.75rem;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.65rem;
	}

	.field-row.double {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.34rem;
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
		padding: 0.68rem 0.78rem;
		font-size: 0.86rem;
		color: #111827;
	}

	.mini-note {
		margin-top: 0.6rem;
		line-height: 1.45;
	}

	.viewer-card {
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.viewer-card.viewer-stage-only {
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
	}

	.viewer-card-head,
	.filmstrip-head,
	.right-sidebar-header {
		padding: 0.9rem 1rem 0.75rem;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.viewer-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.55rem;
		font-size: 0.74rem;
		color: #64748b;
	}

	.viewer-shell {
		flex: 1 1 auto;
		min-height: 22rem;
		border-top: 1px solid rgba(15, 23, 42, 0.06);
		background:
			radial-gradient(circle at top, rgba(14, 116, 144, 0.08), transparent 24%),
			linear-gradient(180deg, #eef2ff, #f8fafc);
		overflow: hidden;
	}

	.viewer-stage-only .viewer-shell {
		min-height: 0;
		height: 100%;
		border-top: none;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
	}

	.viewer-empty {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.viewer-empty-card {
		max-width: 22rem;
		text-align: center;
		padding: 1.25rem;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid rgba(15, 23, 42, 0.08);
	}

	.viewer-empty-card h3 {
		margin: 0;
		font-size: 1rem;
		color: #0f172a;
	}

	.viewer-empty-card p {
		margin: 0.45rem 0 0;
		font-size: 0.84rem;
		color: #334155;
	}

	.filmstrip-card {
		padding: 0 0 0.8rem;
	}

	.filmstrip-card.filmstrip-footer {
		margin-left: -0.9rem;
		margin-right: -0.9rem;
		margin-bottom: -0.9rem;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: rgba(255, 255, 255, 0.96);
		border-top: 1px solid rgba(15, 23, 42, 0.08);
	}

	.filmstrip-head.filmstrip-head-flat {
		padding: 0.6rem 1rem 0.55rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		align-items: center;
	}

	.filmstrip-title-bar {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
	}

	.filmstrip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(190px, 210px);
		gap: 0.75rem;
		overflow-x: auto;
		padding: 0 0.9rem;
	}

	.filmstrip.filmstrip-flat {
		padding: 0;
		gap: 0;
		grid-auto-columns: minmax(220px, 260px);
	}

	.filmstrip-item {
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 14px;
		background: linear-gradient(180deg, #ffffff, #f8fafc);
		padding: 0.7rem;
		display: grid;
		grid-template-columns: 68px minmax(0, 1fr);
		gap: 0.7rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
	}

	.filmstrip-item-flat {
		border: none;
		border-right: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 0;
		background: transparent;
		padding: 0;
		grid-template-columns: 1fr;
		gap: 0;
		min-height: 100%;
	}

	.filmstrip-item-flat.selected {
		background: rgba(239, 246, 255, 0.72);
	}

	.filmstrip-item-flat.base {
		box-shadow: inset 0 1px 0 rgba(59, 130, 246, 0.14);
	}

	.filmstrip-item.selected {
		border-color: rgba(37, 99, 235, 0.34);
		background: linear-gradient(180deg, #ffffff, #eff6ff);
	}

	.filmstrip-item.reference {
		box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.3);
	}

	.filmstrip-item.annotatable:not(.base) {
		background-image: linear-gradient(180deg, #ffffff, #f0fdf4);
	}

	.filmstrip-thumb {
		width: 68px;
		height: 68px;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.filmstrip-select {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0.85rem 0.95rem 0.7rem;
		display: grid;
		grid-template-columns: 68px minmax(0, 1fr);
		gap: 0.75rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		width: 100%;
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
		margin-top: 0.42rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.28rem;
	}

	.filmstrip-actions {
		padding: 0 0.95rem 0.85rem;
	}

	.mini-tag {
		padding: 0.18rem 0.42rem;
		font-size: 0.66rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(241, 245, 249, 0.92);
		color: #475569;
	}

	.mini-tag.base {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.mini-tag.action {
		background: rgba(226, 232, 240, 0.72);
		color: #334155;
	}

	.mini-tag.ref {
		background: rgba(245, 158, 11, 0.12);
		color: #b45309;
	}

	.inline-action {
		width: 100%;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: #fff;
		color: #334155;
		border-radius: 10px;
		padding: 0.62rem 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}

	.inline-action:disabled {
		cursor: default;
		color: #1d4ed8;
		background: rgba(219, 234, 254, 0.72);
		border-color: rgba(59, 130, 246, 0.18);
	}

	.ghost-button.compact {
		padding: 0.46rem 0.68rem;
		font-size: 0.74rem;
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

	.empty-state,
	.empty {
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
	}

	@media (max-width: 980px) {
		.main-body {
			flex-direction: column;
		}

		.field-row.double,
		.group-line,
		.viewer-card-head,
		.filmstrip-head {
			grid-template-columns: 1fr;
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
