<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import WorkspaceSidebar from '$lib/ui/workspace/WorkspaceSidebar.svelte';
	import GroupListItem from '$lib/ui/workspace/GroupListItem.svelte';
	import GroupAnnotationsPanel from '$lib/ui/workspace/GroupAnnotationsPanel.svelte';
	import AlignmentTransformControls from '$lib/ui/alignment/AlignmentTransformControls.svelte';
	import ImageCompareViewer from '$lib/ui/compare/ImageCompareViewer.svelte';
	import AnnotatedImageCompareViewer from '$lib/ui/compare/AnnotatedImageCompareViewer.svelte';
	import { createAnnotationCompareSession } from '$lib/ui/compare/annotationCompareSession';
	import CachedThumb from '$lib/ui/shared/CachedThumb.svelte';

	import {
		ensureAlignmentEngine,
		runAlignmentWorkflow,
		type AlignmentSpec,
		type ComputedAlignment
	} from '$lib/alignment/alignmentWorkflow';
	import { getAlignedImageUrl } from '$lib/alignment/alignedImageCache';
	import type { TransformData } from '$lib/alignment/vggAlignService';
	import { getDerivedBlob, getDerivedUrl } from '$lib/images/derivationService';
	import { getDerivationCacheKey } from '$lib/images/derivationState.svelte';
	import {
		getProjectAnnotationConfig,
		mutateProject,
		projectState
	} from '$lib/project/projectStore.svelte';
	import type {
		AnnotationGeometry,
		AnnotationRecord,
		JsonValue,
		LocalImageSource
	} from '$lib/project/types';

	let leftPanelOpen = $state(true);
	let rightPanelOpen = $state(true);
	let selectedGroupId = $state<string | null>(null);
	let selectedImageId = $state<string | null>(null);
	let alignmentWorkbenchImageId = $state<string | null>(null);
	let annotationBackgroundImageId = $state<string | null>(null);
	let annotationOverlayImageId = $state<string | null>(null);
	let selectedAnnotationId = $state<string | null>(null);
	let pendingAnnotationSelectionId = $state<string | null>(null);
	let alignmentApproach = $state<'auto' | 'feature' | 'manual'>('auto');
	let alignmentSpec = $state<AlignmentSpec>({
		type: 'affine',
		photometric: false
	});
	let alignmentEngineReady = $state(false);
	let alignmentEngineStatus = $state('Loading VGG alignment engine...');
	let alignmentRunError = $state<string | null>(null);
	let alignmentIsRunning = $state(false);
	let alignmentPreviewUrl: string | null = $state(null);
	let alignmentPreviewComputed: ComputedAlignment | null = $state(null);
	let alignmentPreviewRefreshKey = $state(0);

	let project = $derived(projectState.project);
	let groups = $derived(project?.groups ?? []);
	let images = $derived(project?.images ?? []);
	let alignments = $derived(project?.alignments ?? []);
	let annotations = $derived(project?.annotations ?? []);
	let annotationConfig = $derived(getProjectAnnotationConfig(project));

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

	let alignmentWorkbenchImage = $derived(
		alignmentWorkbenchImageId
			? (selectedGroupImages.find((image) => image.id === alignmentWorkbenchImageId) ?? null)
			: null
	);

	let canRunAlignmentWorkbench = $derived(
		Boolean(baseImage && alignmentWorkbenchImage && alignmentEngineReady && !alignmentIsRunning)
	);

	let showAlignmentWorkbench = $derived(
		Boolean(
			hasBaseImage &&
				alignmentWorkbenchImage &&
				alignmentWorkbenchImage.id !== selectedGroup?.baseImageId
		)
	);

	let referenceImage = $derived.by(() => {
		if (!selectedGroup) return null;
		const pool = hasBaseImage ? alignedImages : selectedGroupImages;
		const fallbackId = selectedGroup.baseImageId || pool[0]?.id || null;
		const targetId = annotationBackgroundImageId ?? fallbackId;
		return (
			pool.find((image) => image.id === targetId) ??
			(fallbackId ? (imageById.get(fallbackId) ?? null) : null)
		);
	});

	let comparedImage = $derived.by(() => {
		if (!hasBaseImage || !referenceImage) return null;

		const selected = alignedImages.find((image) => image.id === annotationOverlayImageId);
		if (selected && selected.id !== referenceImage.id) return selected;
		return alignedImages.find((image) => image.id !== referenceImage.id) ?? null;
	});

	let selectedConfirmedAlignment = $derived.by(() => {
		if (!selectedImage || !hasBaseImage) return null;
		return (
			selectedGroupAlignments.find(
				(alignment) =>
					alignment.comparedImageId === selectedImage.id && alignment.status === 'confirmed'
			) ?? null
		);
	});

	let comparedImageAlignment = $derived.by(() => {
		if (!comparedImage) return null;
		return (
			selectedGroupAlignments.find(
				(alignment) =>
					alignment.comparedImageId === comparedImage.id && alignment.status === 'confirmed'
			) ?? null
		);
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

	let selectedAnnotation = $derived.by(
		() => selectedGroupAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null
	);

	let activePairViewerAnnotations = $derived.by(() =>
		activePairAnnotations
			.map((annotation) => projectAnnotationToViewerAnnotation(annotation))
			.filter(Boolean)
	);

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
	let lastSessionAnnotationSignature = $state('');

	$effect(() => {
		const nextSignature = activePairViewerAnnotations
			.map((annotation) => annotationShapeSignature(annotation))
			.sort()
			.join('|');

		if (nextSignature !== lastSessionAnnotationSignature) {
			lastSessionAnnotationSignature = nextSignature;
			compareSession.setAnnotations(activePairViewerAnnotations);
		}

		if (
			selectedAnnotationId &&
			activePairViewerAnnotations.some((annotation) => annotation.id === selectedAnnotationId)
		) {
			if (pendingAnnotationSelectionId === selectedAnnotationId) {
				pendingAnnotationSelectionId = null;
			}
			compareSession.selectAnnotation(selectedAnnotationId);
			return;
		}

		if (pendingAnnotationSelectionId && selectedAnnotationId === pendingAnnotationSelectionId) {
			return;
		}

		compareSession.selectAnnotation(null);
	});

	$effect(() => {
		const unsubscribe = compareSession.selectedId.subscribe((id) => {
			if (id === null && pendingAnnotationSelectionId) return;
			if (selectedAnnotationId === id) return;
			selectedAnnotationId = id;
			if (id) rightPanelOpen = true;
		});

		return unsubscribe;
	});

	$effect(() => {
		if (!project) {
			selectedGroupId = null;
			selectedImageId = null;
			annotationBackgroundImageId = null;
			annotationOverlayImageId = null;
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
			annotationBackgroundImageId = null;
			annotationOverlayImageId = null;
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

		const referencePool = hasBaseImage ? alignedImages : selectedGroupImages;
		if (referencePool.length === 0) {
			annotationBackgroundImageId = null;
			return;
		}

		const fallbackId = selectedGroup.baseImageId || referencePool[0]?.id || null;
		const valid =
			annotationBackgroundImageId &&
			referencePool.some((image) => image.id === annotationBackgroundImageId);
		if (!valid) {
			annotationBackgroundImageId = fallbackId;
		}
	});

	$effect(() => {
		if (!hasBaseImage) {
			annotationOverlayImageId = null;
			return;
		}

		const validOverlayImages = alignedImages.filter(
			(image) => image.id !== annotationBackgroundImageId
		);
		if (validOverlayImages.length === 0) {
			annotationOverlayImageId = null;
			return;
		}

		const valid =
			annotationOverlayImageId &&
			validOverlayImages.some((image) => image.id === annotationOverlayImageId);
		if (!valid) {
			annotationOverlayImageId = validOverlayImages[0]?.id ?? null;
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
		clearAlignmentPreview();
		alignmentRunError = null;
		alignmentWorkbenchImageId = null;
		selectedAnnotationId = null;
	}

	function selectImage(imageId: string) {
		selectedImageId = imageId;
		selectedAnnotationId = null;
	}

	function handleImageTileKeydown(event: KeyboardEvent, imageId: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		selectImage(imageId);
	}

	function openAlignmentWorkbench(imageId: string) {
		selectImage(imageId);
		clearAlignmentPreview();
		alignmentRunError = null;
		alignmentWorkbenchImageId = imageId;
	}

	function closeAlignmentWorkbench() {
		clearAlignmentPreview();
		alignmentRunError = null;
		alignmentWorkbenchImageId = null;
	}

	function setAnnotationBackgroundImage(imageId: string) {
		if (!alignedImageIds.has(imageId)) return;
		const previousBackgroundId = annotationBackgroundImageId;

		annotationBackgroundImageId = imageId;
		selectedImageId = imageId;
		alignmentWorkbenchImageId = null;
		selectedAnnotationId = null;

		if (annotationOverlayImageId === imageId) {
			const fallback =
				(previousBackgroundId &&
					previousBackgroundId !== imageId &&
					alignedImages.some((image) => image.id === previousBackgroundId)
					? previousBackgroundId
					: alignedImages.find((image) => image.id !== imageId)?.id) ?? null;

			annotationOverlayImageId = fallback;
		}
	}

	function setAnnotationOverlayImage(imageId: string) {
		if (!alignedImageIds.has(imageId)) return;
		if (annotationBackgroundImageId === imageId) return;

		annotationOverlayImageId = imageId;
		selectedImageId = imageId;
		alignmentWorkbenchImageId = null;
		selectedAnnotationId = null;
	}

	function selectAnnotation(annotationId: string) {
		const annotation = selectedGroupAnnotations.find((item) => item.id === annotationId);
		if (!annotation) return;

		selectedAnnotationId = annotation.id;
		annotationBackgroundImageId = annotation.anchorImageId;

		const comparedId =
			annotation.targetImageIds.find((imageId) => imageId !== annotation.anchorImageId) ??
			annotation.targetImageIds[0] ??
			null;

		annotationOverlayImageId = comparedId;
		if (comparedId) selectedImageId = comparedId;
		rightPanelOpen = true;
	}

	function annotationShapeSignature(annotation: any): string {
		const selector = annotation?.target?.selector;
		const geometry = selector?.geometry;

		return JSON.stringify({
			id: annotation?.id ?? null,
			type: selector?.type ?? null,
			x: geometry?.x ?? null,
			y: geometry?.y ?? null,
			w: geometry?.w ?? null,
			h: geometry?.h ?? null,
			points: Array.isArray(geometry?.points) ? geometry.points : null
		});
	}

	function buildAnnotationBounds(points: Array<{ x: number; y: number }>) {
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);

		return {
			minX: Math.min(...xs),
			minY: Math.min(...ys),
			maxX: Math.max(...xs),
			maxY: Math.max(...ys)
		};
	}

	function projectGeometryToViewerSelector(geometry: AnnotationGeometry): any | null {
		if (geometry.type === 'rect') {
			const { x, y, w, h } = geometry.value;
			return {
				type: 'RECTANGLE',
				geometry: {
					x,
					y,
					w,
					h,
					bounds: {
						minX: x,
						minY: y,
						maxX: x + w,
						maxY: y + h
					}
				}
			};
		}

		if (geometry.type === 'polygon') {
			const points = geometry.value.points.map((point) => [point.x, point.y]);
			return {
				type: 'POLYGON',
				geometry: {
					points,
					bounds: buildAnnotationBounds(geometry.value.points)
				}
			};
		}

		if (geometry.type === 'line') {
			const points = geometry.value.points.map((point) => [point.x, point.y]);
			return {
				type: 'LINE',
				geometry: {
					points,
					bounds: buildAnnotationBounds(geometry.value.points)
				}
			};
		}

		return null;
	}

	function projectAnnotationToViewerAnnotation(annotation: AnnotationRecord): any | null {
		const selector = projectGeometryToViewerSelector(annotation.geometry);
		if (!selector) return null;

		return {
			id: annotation.id,
			bodies: [],
			target: {
				annotation: annotation.id,
				selector
			}
		};
	}

	function viewerAnnotationToProjectGeometry(annotation: any): AnnotationGeometry | null {
		const selector = annotation?.target?.selector;
		const geometry = selector?.geometry;

		if (selector?.type === 'RECTANGLE' && geometry) {
			return {
				space: 'base-pixels',
				type: 'rect',
				value: {
					x: Number(geometry.x ?? 0),
					y: Number(geometry.y ?? 0),
					w: Number(geometry.w ?? 0),
					h: Number(geometry.h ?? 0)
				}
			};
		}

		if (selector?.type === 'POLYGON' && Array.isArray(geometry?.points) && geometry.points.length >= 3) {
			return {
				space: 'base-pixels',
				type: 'polygon',
				value: {
					points: geometry.points.map(([x, y]: [number, number]) => ({
						x: Number(x ?? 0),
						y: Number(y ?? 0)
					}))
				}
			} as AnnotationGeometry;
		}

		if (selector?.type === 'LINE' && Array.isArray(geometry?.points) && geometry.points.length >= 2) {
			return {
				space: 'base-pixels',
				type: 'line',
				value: {
					points: geometry.points.slice(0, 2).map(([x, y]: [number, number]) => ({
						x: Number(x ?? 0),
						y: Number(y ?? 0)
					}))
				}
			} as AnnotationGeometry;
		}

		return null;
	}

	function toJsonValue(value: unknown): JsonValue {
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean' ||
			value === null
		) {
			return value as JsonValue;
		}

		if (Array.isArray(value)) {
			return value.map((item) => toJsonValue(item));
		}

		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).map(([key, nested]) => [key, toJsonValue(nested)])
			);
		}

		return value == null ? null : String(value);
	}

	function buildDefaultAnnotationData(): Record<string, JsonValue> {
		const schema =
			annotationConfig?.schema && typeof annotationConfig.schema === 'object'
				? (annotationConfig.schema as Record<string, unknown>)
				: {};
		const properties =
			schema.properties && typeof schema.properties === 'object'
				? (schema.properties as Record<string, Record<string, unknown>>)
				: {};

		const seeded: Record<string, JsonValue> = {};

		for (const [key, property] of Object.entries(properties)) {
			if (property.default !== undefined) {
				seeded[key] = toJsonValue(property.default);
				continue;
			}

			if (Array.isArray(property.enum) && property.enum.length > 0) {
				seeded[key] = toJsonValue(property.enum[0]);
				continue;
			}

			if (property.type === 'boolean') {
				seeded[key] = false;
				continue;
			}

			if (property.type === 'number' || property.type === 'integer') {
				seeded[key] = typeof property.minimum === 'number' ? property.minimum : 0;
				continue;
			}

			if (property.type === 'string') {
				seeded[key] = '';
			}
		}

		const configuredDefaults =
			annotationConfig?.defaultData && typeof annotationConfig.defaultData === 'object'
				? Object.fromEntries(
						Object.entries(annotationConfig.defaultData).map(([key, value]) => [key, toJsonValue(value)])
					)
				: {};

		return {
			...seeded,
			...configuredDefaults
		};
	}

	function buildAnnotationContext() {
		if (!selectedGroup || !referenceImage || !comparedImage) return null;

		return {
			groupId: selectedGroup.id,
			anchorImageId: referenceImage.id,
			targetImageIds: [comparedImage.id] as [string],
			alignmentId: comparedImageAlignment?.id,
			schemaId:
				annotationConfig?.sourceProfileId ?? annotationConfig?.sourceProfileName ?? 'annotation'
		};
	}

	function handleViewerAnnotationCreate(annotation: any) {
		const context = buildAnnotationContext();
		if (!context) return;

		const geometry = viewerAnnotationToProjectGeometry(annotation);
		if (!geometry) return;

		mutateProject((nextProject) => {
			const existing = nextProject.annotations.find((item) => item.id === annotation.id);
			if (existing) return;

			nextProject.annotations.push({
				id: annotation.id,
				groupId: context.groupId,
				anchorImageId: context.anchorImageId,
				targetImageIds: context.targetImageIds,
				schemaId: context.schemaId,
				alignmentId: context.alignmentId,
				geometry,
				data: buildDefaultAnnotationData(),
				metadata: {}
			});
		});

		pendingAnnotationSelectionId = annotation.id;
		selectedAnnotationId = annotation.id;
		rightPanelOpen = true;
	}

	function handleViewerAnnotationUpdate(annotation: any) {
		const geometry = viewerAnnotationToProjectGeometry(annotation);
		if (!geometry) return;

		mutateProject((nextProject) => {
			const existing = nextProject.annotations.find((item) => item.id === annotation.id);
			if (!existing) return;
			existing.geometry = geometry;
		});
	}

	function handleViewerAnnotationDelete(annotation: any) {
		const id = annotation?.id;
		if (!id) return;

		mutateProject((nextProject) => {
			nextProject.annotations = nextProject.annotations.filter((item) => item.id !== id);
		});
	}

	function handleAnnotationDataChange(annotationId: string, nextValue: Record<string, unknown>) {
		mutateProject((nextProject) => {
			const annotation = nextProject.annotations.find((item) => item.id === annotationId);
			if (!annotation) return;

			annotation.data = Object.fromEntries(
				Object.entries(nextValue).map(([key, value]) => [key, toJsonValue(value)])
			);
		});
	}

	function setImageAsBase(imageId: string) {
		if (!selectedGroup) return;
		const nextBaseImage = selectedGroupImages.find((image) => image.id === imageId) ?? null;
		if (!nextBaseImage) return;

		mutateProject((nextProject) => {
			const targetGroup = nextProject.groups.find((group) => group.id === selectedGroup.id);
			if (!targetGroup) return;
			targetGroup.baseImageId = nextBaseImage.id;
		});

		annotationBackgroundImageId = nextBaseImage.id;
		annotationOverlayImageId = null;
		selectedImageId = nextBaseImage.id;
		clearAlignmentPreview();
		alignmentRunError = null;
		alignmentWorkbenchImageId = null;
		selectedAnnotationId = null;
	}

	function confirmAlignment() {
		if (!selectedGroup || !baseImage || !alignmentWorkbenchImage || !alignmentPreviewComputed) return;

		const confirmedImage = alignmentWorkbenchImage;
		const confirmedTransform = alignmentPreviewComputed.transform;

		mutateProject((nextProject) => {
			const existing = nextProject.alignments.find(
				(item) =>
					item.groupId === selectedGroup.id &&
					item.baseImageId === baseImage.id &&
					item.comparedImageId === alignmentWorkbenchImage.id
			);

			const nextResult = {
				transformModel: alignmentPreviewComputed.transform.type,
				...alignmentPreviewComputed.transform
			};

			if (existing) {
				existing.status = 'confirmed';
				existing.schemaId =
					existing.schemaId ||
					nextProject.definitions.alignmentSchemas[0]?.id ||
					'vgg-align';
				existing.params = {
					type: alignmentPreviewComputed.spec.type,
					photometric: alignmentPreviewComputed.spec.photometric,
					approach: alignmentApproach
				};
				existing.result = nextResult;
				return;
			}

			nextProject.alignments.push({
				id: `alignment:${selectedGroup.id}:${baseImage.id}:${alignmentWorkbenchImage.id}`,
				groupId: selectedGroup.id,
				baseImageId: baseImage.id,
				comparedImageId: alignmentWorkbenchImage.id,
				schemaId: nextProject.definitions.alignmentSchemas[0]?.id || 'vgg-align',
				status: 'confirmed',
				params: {
					type: alignmentPreviewComputed.spec.type,
					photometric: alignmentPreviewComputed.spec.photometric,
					approach: alignmentApproach
				},
				result: nextResult
			});
		});

		void resolveAlignmentFile(confirmedImage)
			.then((sourceFile) => getAlignedImageUrl(confirmedImage.contentHash, confirmedTransform, sourceFile))
			.then((res) => res.release())
			.catch((error) => {
				console.warn('Unable to warm aligned-image cache', error);
			});

		annotationOverlayImageId = alignmentWorkbenchImage.id;
		selectedImageId = alignmentWorkbenchImage.id;
		alignmentWorkbenchImageId = null;
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
		annotationBackgroundImageId = selectedGroup.imageIds[0] ?? null;
		annotationOverlayImageId = null;
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
		clearAlignmentPreview();
		alignmentRunError = null;
		alignmentWorkbenchImageId = null;
		annotationBackgroundImageId = null;
		annotationOverlayImageId = null;
		selectedAnnotationId = null;
	}

	function resetImageWorkflow(imageId: string) {
		if (!selectedGroup) return;
		const targetImage = selectedGroupImages.find((image) => image.id === imageId) ?? null;
		if (!targetImage || targetImage.id === selectedGroup.baseImageId) return;

		const confirmed = window.confirm(
			`Remove the alignment for "${getImageTitle(targetImage)}"? Any annotations made with this image will be lost.`
		);

		if (!confirmed) return;

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
		if (alignmentWorkbenchImageId === imageId) {
			alignmentWorkbenchImageId = null;
		}
		if (annotationBackgroundImageId === imageId) {
			annotationBackgroundImageId = selectedGroup.baseImageId || null;
		}
		if (annotationOverlayImageId === imageId) {
			annotationOverlayImageId = null;
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

	function alignmentResultToTransformData(result: Record<string, unknown> | null): TransformData | null {
		if (!result) return null;
		const H = Array.isArray(result.H) ? result.H.map((value) => Number(value)) : null;
		const targetSizeValue = result.targetSize;
		const targetSize =
			targetSizeValue && typeof targetSizeValue === 'object'
				? {
						width: Number((targetSizeValue as { width?: unknown }).width ?? 0),
						height: Number((targetSizeValue as { height?: unknown }).height ?? 0)
					}
				: null;
		const type = typeof result.transformModel === 'string' ? result.transformModel : result.type;

		if (!H || !targetSize || typeof type !== 'string' || !targetSize.width || !targetSize.height) {
			return null;
		}

		return {
			...(result as unknown as TransformData),
			type: type as TransformData['type'],
			H,
			targetSize
		};
	}

	let viewerMode = $derived.by(() => {
		if (isBaseSelectionPhase) return 'base-selection';
		if (showAlignmentWorkbench) return 'align';
		if (hasBaseImage && selectedImage && selectedImage.id !== selectedGroup?.baseImageId && !selectedConfirmedAlignment)
			return 'inspect';
		if (hasBaseImage) return 'annotate';
		return 'base-selection';
	});

	let previewBaseImage = $derived.by(() => {
		if (viewerMode === 'base-selection')
			return selectedImage ?? baseImage ?? selectedGroupImages[0] ?? null;
		if (viewerMode === 'annotate') return referenceImage;
		if (viewerMode === 'inspect') return selectedImage ?? baseImage ?? selectedGroupImages[0] ?? null;
		if (viewerMode === 'align') return baseImage;
		return alignmentTargetImage ?? baseImage ?? selectedGroupImages[0] ?? null;
	});

	let previewOverlayImage = $derived.by(() => {
		if (viewerMode === 'annotate') return comparedImage;
		if (viewerMode === 'inspect') return null;
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

	function releaseObjectUrl(url: string | null) {
		if (url) URL.revokeObjectURL(url);
	}

	function clearAlignmentPreview() {
		releaseObjectUrl(alignmentPreviewUrl);
		alignmentPreviewUrl = null;
		alignmentPreviewComputed = null;
		alignmentPreviewRefreshKey += 1;
	}

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

	async function loadAnnotatedPreview(
		nextBaseHash: string,
		overlayImage: (typeof images)[number],
		alignment: (typeof alignments)[number] | null
	) {
		const id = ++previewRunId;
		cleanupPreview();
		previewState = 'loading';

		try {
			const baseRes = await getDerivedUrl(nextBaseHash, 'work');
			let overlayRes: Awaited<ReturnType<typeof getAlignedImageUrl>> | Awaited<ReturnType<typeof getDerivedUrl>> | null =
				null;

			const transform = alignmentResultToTransformData(
				(alignment?.result as Record<string, unknown> | undefined) ?? null
			);

			if (transform) {
				const sourceFile = await resolveAlignmentFile(overlayImage);
				overlayRes = await getAlignedImageUrl(overlayImage.contentHash, transform, sourceFile);
			} else {
				overlayRes = await getDerivedUrl(overlayImage.contentHash, 'work');
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
			console.error('Error loading annotated preview', error);
			if (id !== previewRunId) return;
			cleanupPreview();
			previewState = 'missing';
		}
	}

	async function getFileFromLocalSource(image: (typeof images)[number]): Promise<File> {
		if (image.source.kind !== 'local') {
			throw new Error('Local source required');
		}

		const source = image.source as LocalImageSource;
		const rootHandle = projectState.assetRootHandles[source.rootId];
		if (!rootHandle) {
			throw new Error(`Reconnect the asset root for "${getImageTitle(image)}" before aligning.`);
		}

		const parts = source.imageRef.split('/').filter(Boolean);
		let dir = rootHandle;

		for (let i = 0; i < parts.length - 1; i += 1) {
			dir = await dir.getDirectoryHandle(parts[i]);
		}

		const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
		return await fileHandle.getFile();
	}

	async function resolveAlignmentFile(image: (typeof images)[number]): Promise<File> {
		let blob: Blob;
		try {
			blob = await getDerivedBlob(image.contentHash, 'work');
		} catch {
			if (image.source.kind === 'local') {
				const localFile = await getFileFromLocalSource(image);
				return localFile;
			}

			const response = await fetch(image.source.url);
			if (!response.ok) {
				throw new Error(`Unable to load "${getImageTitle(image)}" for alignment.`);
			}
			blob = await response.blob();
		}

		const extension = blob.type === 'image/png' ? 'png' : 'jpg';
		return new File([blob], `${getImageTitle(image)}.${extension}`, { type: blob.type });
	}

	async function runAlignmentWorkbench() {
		if (!baseImage || !alignmentWorkbenchImage || !canRunAlignmentWorkbench) return;

		alignmentIsRunning = true;
		alignmentRunError = null;
		clearAlignmentPreview();

		try {
			const [baseFile, queryFile] = await Promise.all([
				resolveAlignmentFile(baseImage),
				resolveAlignmentFile(alignmentWorkbenchImage)
			]);

			const result = await runAlignmentWorkflow({
				baseFile,
				queryFile,
				spec: alignmentSpec
			});

			alignmentPreviewComputed = {
				spec: result.spec,
				transform: result.transform
			};
			alignmentPreviewUrl = result.warpedUrl;
			alignmentPreviewRefreshKey += 1;
		} catch (error) {
			alignmentRunError =
				error instanceof Error ? error.message : 'Alignment failed to complete.';
		} finally {
			alignmentIsRunning = false;
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

		if (viewerMode === 'annotate' && previewOverlayImage) {
			void loadAnnotatedPreview(currentBaseHash, previewOverlayImage, comparedImageAlignment);
			return;
		}

		void loadPreview(currentBaseHash, currentOverlayHash);
	});

	onMount(() => {
		void ensureAlignmentEngine()
			.then(() => {
				alignmentEngineReady = true;
				alignmentEngineStatus = 'Engine ready';
			})
			.catch((error) => {
				alignmentEngineReady = false;
				alignmentEngineStatus = 'Engine failed to load';
				alignmentRunError =
					error instanceof Error ? error.message : 'Failed to load alignment engine.';
			});
	});

	onDestroy(() => {
		previewRunId += 1;
		cleanupPreview();
		clearAlignmentPreview();
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
									: viewerMode === 'inspect'
										? 'View'
									: 'Choose base'}
						</div>
					</div>
				</section>

				<div class="main-body">
					<section
						class="stage-column"
						class:base-selection-layout={isBaseSelectionPhase}
					>
						<section class="viewer-card" class:viewer-stage-only={isBaseSelectionPhase}>
							{#if !isBaseSelectionPhase}
								<div class="viewer-card-head">
									<div>
										<div class="viewer-title">
											{#if viewerMode === 'annotate' && referenceImage && comparedImage}
												{getImageTitle(referenceImage)} -> {getImageTitle(comparedImage)}
											{:else if viewerMode === 'annotate' && referenceImage}
												{getImageTitle(referenceImage)}
											{:else if viewerMode === 'inspect' && selectedImage}
												{getImageTitle(selectedImage)}
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
												{comparedImage
													? 'Annotated comparison viewer'
													: 'Annotated single-image viewer'}
											{:else if viewerMode === 'inspect'}
												Single-image preview
											{:else if viewerMode === 'align'}
												Simple compare viewer for alignment review
											{:else}
												Base-image preview
											{/if}
										</div>
									</div>

									<div class="viewer-meta">
										{#if viewerMode === 'annotate'}
											<span>
												{comparedImage
													? `${activePairAnnotations.length} pair annotations`
													: `${selectedGroupAnnotations.length} group annotations`}
											</span>
										{:else if viewerMode === 'align' && activeAlignment}
											<span>{activeAlignment.status}</span>
											<span>{activeAlignment.result.transformModel}</span>
										{/if}
									</div>
								</div>
							{/if}

							<div class="viewer-shell">
								{#if viewerMode === 'align'}
									<div class="alignment-result-panel">
										<div class="alignment-viewer-shell">
											{#if alignmentPreviewUrl && baseUrl}
												{#key `${baseUrl}:${alignmentPreviewUrl}:${alignmentPreviewRefreshKey}`}
													<div class="alignment-viewer-host">
														<AnnotatedImageCompareViewer
															imageUrl={baseUrl}
															overlayUrl={alignmentPreviewUrl}
															session={compareSession}
															onCreate={handleViewerAnnotationCreate}
															onUpdate={handleViewerAnnotationUpdate}
															onDelete={handleViewerAnnotationDelete}
															initialViewState={{
																overlayOpacity: 0.6,
																annotationsVisible: true,
																annotationMode: 'pan',
																readingFocusEnabled: false,
																readingFocusClearCenterPct: 30,
																readingFocusOpacity: 0.35,
																readingFocusBlurPx: 3
															}}
															refreshKey={alignmentPreviewRefreshKey}
														/>
													</div>
												{/key}
											{:else}
												<div class="viewer-empty">
													<div class="viewer-empty-card">
														<h3>No alignment result yet</h3>
														<p>
															Run the alignment controls to generate an aligned preview for
															{alignmentWorkbenchImage ? ` ${getImageTitle(alignmentWorkbenchImage)}` : ' the selected image'}.
														</p>
													</div>
												</div>
											{/if}

											<div class="alignment-controls-overlay">
												<div class="alignment-overlay-card">
													<div class="alignment-overlay-top">
														<div class="mini-kicker">Alignment</div>

														<button
															type="button"
															class="ghost-button compact"
															onclick={closeAlignmentWorkbench}
														>
															Close
														</button>
													</div>

													<AlignmentTransformControls
														spec={alignmentSpec}
														engineStatus={alignmentEngineStatus}
														isRunning={alignmentIsRunning}
														canAlign={canRunAlignmentWorkbench}
														error={alignmentRunError}
														onRun={runAlignmentWorkbench}
														onSpecChange={(nextSpec) => (alignmentSpec = nextSpec)}
													/>

													<button
														type="button"
														class="action-button"
														disabled={!alignmentPreviewComputed}
														onclick={confirmAlignment}
													>
														Confirm alignment
													</button>
												</div>
											</div>
										</div>
									</div>
								{:else if previewState === 'ready' && baseUrl}
									{#key `${baseUrl}:${overlayUrl ?? ''}:${viewerRefreshKey}:${viewerMode}`}
										{#if viewerMode === 'annotate' && overlayUrl}
											<AnnotatedImageCompareViewer
												imageUrl={baseUrl}
												{overlayUrl}
												session={compareSession}
												onCreate={handleViewerAnnotationCreate}
												onUpdate={handleViewerAnnotationUpdate}
												onDelete={handleViewerAnnotationDelete}
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
									{@const isAlignedImage =
										image.id === selectedGroup.baseImageId || confirmedAlignmentIds.has(image.id)}
									{#if isBaseSelectionPhase}
										<div
											class="filmstrip-item filmstrip-item-flat"
											class:selected={image.id === selectedImageId}
											class:base={image.id === selectedGroup.baseImageId}
										>
											<div
												class="filmstrip-select filmstrip-select-card"
												role="button"
												tabindex="0"
												onclick={() => selectImage(image.id)}
												onkeydown={(event) => handleImageTileKeydown(event, image.id)}
											>
												<div class="filmstrip-thumb">
													<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
													{#if image.id === selectedGroup.baseImageId}
														<span class="thumb-pill">Base</span>
													{:else}
														<button
															type="button"
															class="thumb-center-action"
															onclick={(event) => {
																event.stopPropagation();
																selectImage(image.id);
																setImageAsBase(image.id);
															}}
														>
															Set as base image
														</button>
													{/if}
												</div>

												<div class="filmstrip-copy">
													<div class="filmstrip-title">{getImageTitle(image)}</div>
													<div class="filmstrip-subline">
														{getImageSourceKind(image)} · {image.dimensions.width} × {image
															.dimensions.height}
													</div>
												</div>
											</div>
										</div>
									{:else}
										<div
											class="filmstrip-item"
											class:selected={image.id === selectedImageId}
											class:reference={image.id === referenceImage?.id}
											class:annotatable={alignedImageIds.has(image.id)}
											class:active-background={image.id === referenceImage?.id}
											class:active-overlay={image.id === comparedImage?.id}
											role="button"
											tabindex="0"
											onclick={() => selectImage(image.id)}
											onkeydown={(event) => handleImageTileKeydown(event, image.id)}
										>
											<div class="filmstrip-select filmstrip-select-card">
												<div class="filmstrip-thumb">
													<CachedThumb contentHash={image.contentHash} alt={getImageTitle(image)} />
													{#if image.id === selectedGroup.baseImageId}
														<span class="thumb-pill">Base</span>
													{:else if confirmedAlignmentIds.has(image.id)}
														<button
															type="button"
															class="thumb-pill aligned thumb-pill-button"
															onclick={(event) => {
																event.stopPropagation();
																resetImageWorkflow(image.id);
															}}
														>
															Aligned
														</button>
													{:else}
														<button
															type="button"
															class="thumb-center-action"
															onclick={(event) => {
																event.stopPropagation();
																openAlignmentWorkbench(image.id);
															}}
														>
															Align image
														</button>
													{/if}
												</div>

												<div class="filmstrip-copy">
													<div class="filmstrip-title">{getImageTitle(image)}</div>
													<div class="filmstrip-subline">
														{getImageSourceKind(image)} · {image.dimensions.width} × {image.dimensions
															.height}
													</div>

													<div class="filmstrip-actions">
														{#if isAlignedImage}
															<button
																type="button"
																class="mini-action"
																class:active={image.id === referenceImage?.id}
																onclick={(event) => {
																	event.stopPropagation();
																	setAnnotationBackgroundImage(image.id);
																}}
															>
																Background
															</button>
															<button
																type="button"
																class="mini-action"
																class:active={image.id === comparedImage?.id}
																disabled={image.id === referenceImage?.id}
																onclick={(event) => {
																	event.stopPropagation();
																	setAnnotationOverlayImage(image.id);
																}}
															>
																Overlay
															</button>
														{/if}
													</div>
												</div>
											</div>
										</div>
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
								{selectedAnnotation}
								annotationSchema={annotationConfig?.schema ?? null}
								{activePairImageIds}
								imageTitleById={Object.fromEntries(imageTitleById)}
								{geometrySummary}
								onSelect={selectAnnotation}
								onDataChange={handleAnnotationDataChange}
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
		--workspace-footer-height: 236px;
		--workspace-footer-head-height: 40px;
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
		min-height: 0;
		overflow: hidden;
	}

	.group-header-card {
		flex: 0 0 auto;
		min-height: var(--workspace-header-height);
		padding: 0.45rem 1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
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

	.phase-pill {
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
		overflow: hidden;
	}

	.stage-column {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		height: 100%;
		display: grid;
		grid-template-rows: minmax(0, 1fr) var(--workspace-footer-height);
		gap: 0;
		padding: 0;
		overflow: hidden;
	}

	.stage-column.base-selection-layout {
		gap: 0;
		padding: 0;
		grid-template-rows: minmax(0, 1fr) var(--workspace-footer-height);
	}

	.viewer-card,
	.filmstrip-card {
		background: rgba(255, 255, 255, 0.96);
	}

	.mini-kicker {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b45309;
	}

	.viewer-title,
	.right-sidebar-title {
		margin-top: 0.22rem;
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
	}

	.alignment-result-panel {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		padding: 0.85rem;
		box-sizing: border-box;
	}

	.alignment-viewer-shell {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		border-radius: 16px;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: #f8fafc;
		overflow: hidden;
	}

	.alignment-viewer-host {
		position: absolute;
		inset: 0;
	}

	.alignment-viewer-host :global(.viewer-shell),
	.alignment-viewer-host :global(.wheel-capture),
	.alignment-viewer-host :global(.osd) {
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.alignment-controls-overlay {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		width: min(320px, calc(100% - 1.5rem));
		z-index: 2;
	}

	.alignment-overlay-card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.75rem;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid rgba(148, 163, 184, 0.22);
		box-shadow:
			0 14px 30px rgba(15, 23, 42, 0.12),
			0 2px 6px rgba(15, 23, 42, 0.08);
		backdrop-filter: blur(12px);
	}

	.alignment-overlay-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
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

	.alignment-overlay-card :global(.transform-card) {
		padding: 0.65rem 0.7rem;
		border-radius: 12px;
		box-shadow: none;
		background: rgba(248, 250, 252, 0.92);
	}

	.alignment-overlay-card :global(.transform-top) {
		align-items: center;
		gap: 0.75rem;
	}

	.alignment-overlay-card :global(.title-block h2) {
		font-size: 0.88rem;
	}

	.alignment-overlay-card :global(.title-block p) {
		font-size: 0.72rem;
		margin-top: 0.18rem;
	}

	.alignment-overlay-card :global(.transform-controls) {
		gap: 0.6rem 0.75rem;
	}

	.alignment-overlay-card :global(.field) {
		min-width: 0;
	}

	.alignment-overlay-card :global(.model-field) {
		flex-basis: 100%;
	}

	.viewer-card {
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		margin: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
	}

	.viewer-card.viewer-stage-only {
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
		margin: 0;
	}

	.viewer-card-head,
	.filmstrip-head,
	.right-sidebar-header {
		padding: 0.75rem 1rem 0.6rem;
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
		min-height: 0;
		height: 100%;
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
		height: var(--workspace-footer-height);
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: rgba(255, 255, 255, 0.96);
		border-top: 1px solid rgba(15, 23, 42, 0.08);
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.filmstrip-head.filmstrip-head-flat {
		min-height: var(--workspace-footer-head-height);
		padding: 0.2rem 1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		align-items: center;
	}

	.filmstrip-title-bar {
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.1;
		color: #0f172a;
	}

	.filmstrip {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 132px;
		gap: 0.75rem;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 0.2rem 1rem 0.45rem;
		align-content: start;
	}

	.filmstrip.filmstrip-flat {
		padding: 0.2rem 1rem 0.45rem;
		gap: 0;
		grid-auto-columns: 148px;
	}

	.filmstrip-item {
		border: none;
		border-radius: 4px;
		background: transparent;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.55rem;
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
		box-shadow: none;
	}

	.filmstrip-item.selected {
		background: transparent;
	}

	.filmstrip-item.reference {
		box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.3);
	}

	.filmstrip-item.annotatable:not(.base) {
		background-image: none;
	}

	.filmstrip-thumb {
		position: relative;
		width: 100%;
		aspect-ratio: 0.82 / 1;
		height: auto;
		border-radius: 2px;
		overflow: hidden;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #f8fafc;
	}

	.thumb-pill {
		position: absolute;
		top: 0.45rem;
		right: 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.22rem 0.48rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1;
		background: #0f766e;
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(15, 118, 110, 0.18);
	}

	.thumb-pill-button {
		border: none;
		cursor: pointer;
	}

	.thumb-pill.aligned {
		background: rgba(16, 185, 129, 0.92);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.18);
	}

	.thumb-center-action {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: rgba(255, 255, 255, 0.94);
		color: #0f172a;
		border-radius: 999px;
		padding: 0.45rem 0.68rem;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
	}

	.filmstrip-select {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0.85rem 0.95rem 0.7rem;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.6rem;
		text-align: left;
		cursor: pointer;
		color: inherit;
		width: 100%;
	}

	.filmstrip-select-card {
		padding: 0;
	}

	.filmstrip-copy {
		min-width: 0;
		padding: 0 0.08rem;
		display: grid;
		gap: 0.3rem;
		align-content: start;
	}

	.filmstrip-title {
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.2;
		color: #111827;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.filmstrip-subline {
		font-size: 0.7rem;
		line-height: 1.28;
		color: #64748b;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.filmstrip-actions {
		min-height: 2rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: flex-start;
	}

	.mini-action {
		border: 1px solid rgba(148, 163, 184, 0.28);
		background: rgba(255, 255, 255, 0.96);
		color: #334155;
		border-radius: 999px;
		padding: 0.24rem 0.52rem;
		font-size: 0.66rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	.mini-action.active {
		border-color: rgba(15, 118, 110, 0.3);
		background: rgba(15, 118, 110, 0.1);
		color: #0f766e;
	}

	.mini-action:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ghost-button.compact {
		padding: 0.46rem 0.68rem;
		font-size: 0.74rem;
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

		.group-line,
		.viewer-card-head,
		.filmstrip-head {
			grid-template-columns: 1fr;
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
