import { writable, derived, get } from 'svelte/store';
import type {
    ImageAlignmentProject as Project,
    ImageGroup,
    ImageAlignment,
    ImagePreparation,
    ProjectUIState
} from './types';
import type { RuntimeImageSource } from './runtimeTypes';
import {
    regeneratePreparedWorking,
    regenerateCanonicalNormalised,
    invalidatePrepared,
    computePHashFromNormalised
} from '$lib/image/derivation';

/* ============================================================
   CORE WRITABLE STORES (authoritative state)
============================================================ */

export const projectMeta = writable<{
    version: Project['version'];
    createdAt: string;
    notes?: string;
}>({
    version: '0.2',
    createdAt: new Date().toISOString()
});

export const images = writable<RuntimeImageSource[]>([]);
export const groups = writable<ImageGroup[]>([]);
export const alignments = writable<ImageAlignment[]>([]);
export const annotations = writable<Project['annotations']>([]);
export const projectUI = writable<ProjectUIState | undefined>(undefined);

/* ============================================================
   DERIVED STORES (read-only, computed)
============================================================ */

export const imagesById = derived(images, ($images) =>
    Object.fromEntries($images.map(img => [img.id, img]))
);

export const groupsById = derived(groups, ($groups) =>
    Object.fromEntries($groups.map(group => [group.id, group]))
);

export const alignmentsBySourceImage = derived(
    alignments,
    ($alignments) => {
        const map = new Map<string, ImageAlignment[]>();
        for (const a of $alignments) {
            if (!map.has(a.sourceImageId)) {
                map.set(a.sourceImageId, []);
            }
            map.get(a.sourceImageId)!.push(a);
        }
        return map;
    }
);

export const annotationStatus = derived(
    [annotations, images],
    ([$annotations, $images]) => {
        if ($annotations.length === 0) return 'none';

        const imageHashes = new Set(
            $images.map(img => img.hashes.contentHash)
        );

        const invalid = $annotations.some(
            a => !imageHashes.has(a.baseImageContentHash)
        );

        return invalid ? 'mismatch' : 'valid';
    }
);

export const ungroupedImageIds = derived(
    [images, groups],
    ([$images, $groups]) => {
        const grouped = new Set<string>();

        for (const g of $groups) {
            for (const id of g.imageIds) {
                grouped.add(id);
            }
        }

        return $images
            .filter((img) => !grouped.has(img.id))
            .map((img) => img.id);
    }
);

export const linkedImagesByHash = derived(images, ($images) =>
    new Set(
        $images
            .filter((img) => img.runtimeUri && img.runtimeUri.length > 0)
            .map((img) => img.hashes.contentHash)
    )
);

export const project = derived(
    [projectMeta, images, groups, alignments, annotations, projectUI],
    ([$meta, $images, $groups, $alignments, $annotations, $ui]): Project | null => {
        if ($images.length === 0) return null;

        const persistableImages = $images.map(({ runtimeUri, ...rest }) => rest);

        return {
            version: $meta.version,
            createdAt: $meta.createdAt,
            images: persistableImages as [Project['images'][number], ...Project['images'][number][]],
            groups: $groups,
            alignments: $alignments,
            notes: $meta.notes,
            annotations: $annotations.length ? $annotations : undefined,
            ui: $ui && Object.keys($ui).length > 0 ? $ui : undefined
        };
    }
);

/* ============================================================
   PURE STATE MUTATIONS
============================================================ */

export function resetProject() {
    projectMeta.set({
        version: '0.2',
        createdAt: new Date().toISOString()
    });

    images.set([]);
    groups.set([]);
    alignments.set([]);
    annotations.set([]);
    projectUI.set(undefined);
}

export function setProjectMeta(meta: Parameters<typeof projectMeta.set>[0]) {
    projectMeta.set(meta);
}

export function setImages(list: RuntimeImageSource[]) {
    images.set(list);
}

export function setGroups(list: ImageGroup[]) {
    groups.set(list);
}

export function setAlignments(list: ImageAlignment[]) {
    alignments.set(list);
}

export function setAnnotations(list: Project['annotations']) {
    annotations.set(list);
}

export function setProjectUI(ui: ProjectUIState | undefined) {
    projectUI.set(ui);
}

export function updateProjectUI(partial: Partial<ProjectUIState>) {
    projectUI.update((current) => ({
        ...current,
        ...partial
    }));
}

/* ============================================================
   IMAGE MUTATIONS
============================================================ */

export function addImage(image: RuntimeImageSource) {
    images.update(imgs => [...imgs, image]);
}

export function updateImage(
    imageId: string,
    updater: (img: RuntimeImageSource) => RuntimeImageSource
) {
    images.update((list) => {
        const idx = list.findIndex((img) => img.id === imageId);
        if (idx === -1) return list;

        const next = [...list];
        next[idx] = updater(next[idx]);
        return next;
    });
}

export function updateImageByContentHash(
    contentHash: string,
    updater: (img: RuntimeImageSource) => RuntimeImageSource
) {
    images.update((list) => {
        const idx = list.findIndex(
            (img) => img.hashes.contentHash === contentHash
        );

        if (idx === -1) return list;

        const current = list[idx];
        const updated = updater(current);

        // Revoke old blob URL if necessary
        if (
            current.runtimeUri &&
            current.runtimeUri !== updated.runtimeUri &&
            current.runtimeUri.startsWith('blob:')
        ) {
            URL.revokeObjectURL(current.runtimeUri);
        }

        const next = [...list];
        next[idx] = updated;

        return next;
    });
}

export function upsertImageByContentHash(
    contentHash: string,
    create: () => RuntimeImageSource,
    update: (img: RuntimeImageSource) => RuntimeImageSource
) {
    images.update((list) => {
        const idx = list.findIndex(
            (img) => img.hashes.contentHash === contentHash
        );

        if (idx === -1) {
            return [...list, create()];
        }

        const next = [...list];
        next[idx] = update(next[idx]);
        return next;
    });
}

export function findImageByContentHash(
    contentHash: string
): RuntimeImageSource | undefined {
    return get(images).find(
        (img) => img.hashes.contentHash === contentHash
    );
}

export function removeImage(imageId: string) {
    images.update((list) => list.filter((img) => img.id !== imageId));
}

/* ============================================================
   GROUP MUTATIONS
============================================================ */

export function addGroup(group: ImageGroup) {
    groups.update((gs) => {
        const idx = gs.findIndex((g) => g.id === group.id);
        if (idx !== -1) {
            // Idempotent: replace existing entry (prevents each_key_duplicate crashes)
            const next = [...gs];
            next[idx] = group;
            return next;
        }
        return [...gs, group];
    });
}

export function addGroups(newGroups: ImageGroup[]) {
    groups.update((gs) => {
        const byId = new Map(gs.map((g) => [g.id, g]));
        for (const g of newGroups) byId.set(g.id, g);
        return Array.from(byId.values());
    });
}

export function updateGroup(
    groupId: string,
    updater: (g: ImageGroup) => ImageGroup
) {
    groups.update(gs =>
        gs.map(g => (g.id === groupId ? updater(g) : g))
    );
}

export function removeGroup(groupId: string) {
    groups.update(gs => gs.filter(g => g.id !== groupId));
}

export function removeFromAllGroups(imageId: string) {
    groups.update((list) =>
        list.flatMap((g) => {
            const remaining = g.imageIds.filter((id) => id !== imageId);

            if (remaining.length === 0) {
                return [];
            }

            const [first, ...rest] = remaining;

            return [
                {
                    ...g,
                    imageIds: [first, ...rest],
                    baseImageId:
                        remaining.includes(g.baseImageId)
                            ? g.baseImageId
                            : first
                }
            ];
        })
    );
}

export function addImageToGroup(groupId: string, imageId: string) {
    groups.update((gs) =>
        gs.map((g) =>
            g.id === groupId && !g.imageIds.includes(imageId)
                ? {
                    ...g,
                    imageIds: [...g.imageIds, imageId]
                }
                : g
        )
    );
}

export function removeImageFromGroup(groupId: string, imageId: string) {
    groups.update((gs) =>
        gs.flatMap((g) => {
            if (g.id !== groupId) return g;

            const remaining = g.imageIds.filter((id) => id !== imageId);

            if (remaining.length === 0) {
                return [];
            }

            const baseImageId =
                g.baseImageId === imageId
                    ? remaining[0]
                    : g.baseImageId;

            return {
                ...g,
                imageIds: remaining,
                baseImageId
            };
        })
    );
}

export function setGroupBaseImage(groupId: string, imageId: string) {
    groups.update((gs) =>
        gs.map((g) =>
            g.id === groupId && g.imageIds.includes(imageId)
                ? { ...g, baseImageId: imageId }
                : g
        )
    );
}

/* ============================================================
   ALIGNMENT MUTATIONS
============================================================ */

export function addAlignment(alignment: ImageAlignment) {
    alignments.update(a => [...a, alignment]);
}

export function removeAlignment(alignmentIdx: number) {
    alignments.update((list) =>
        list.filter((_, idx) => idx !== alignmentIdx)
    );
}

export function removeAlignmentsForImage(imageId: string) {
    alignments.update((list) =>
        list.filter(
            (a) =>
                a.sourceImageId !== imageId &&
                a.targetImageId !== imageId
        )
    );
}

/* ============================================================
   ANNOTATION MUTATIONS
============================================================ */

export function addAnnotation(annotation: Project['annotations'][number]) {
    annotations.update(list => [...list, annotation]);
}

export function replaceAnnotations(next: Project['annotations']) {
    annotations.set(next);
}

export function removeAnnotationsForImage(imageId: string) {
    const image = get(images).find((img) => img.id === imageId);
    if (!image) return;

    const hash = image.hashes.contentHash;

    annotations.update((list) =>
        list.filter(
            (a) =>
                a.baseImageContentHash !== hash &&
                a.comparedImageContentHash !== hash
        )
    );
}

/* ============================================================
   IMAGE PREPARATION (side-effects orchestrated from store)
============================================================ */

export async function updateImagePreparation(
    imageId: string,
    preparation: ImagePreparation
) {
    const currentImages = get(images);
    const image = currentImages.find((img) => img.id === imageId);
    if (!image) return;

    if (!image.runtimeUri) {
        console.warn("Skipping regeneration - no runtime image yet");
        return;
    }

    const contentHash = image.hashes.contentHash;

    /* Update metadata immediately */
    images.update((list) =>
        list.map((img) =>
            img.id === imageId
                ? {
                    ...img,
                    preparation
                }
                : img
        )
    );

    /* Invalidate old derived artefacts */
    await invalidatePrepared(contentHash);

    /* Regenerate prepared working image */
    await regeneratePreparedWorking(contentHash, preparation);

    /* Regenerate canonical 512px grayscale */
    await regenerateCanonicalNormalised(contentHash, preparation);

    /* Compute pHash from canonical */
    const perceptualHash = await computePHashFromNormalised(contentHash);

    /* Persist perceptualHash into store */
    images.update((list) =>
        list.map((img) =>
            img.hashes.contentHash === contentHash
                ? {
                    ...img,
                    hashes: {
                        ...img.hashes,
                        perceptualHash
                    }
                }
                : img
        )
    );

    /* Invalidate downstream pipeline */
    removeFromAllGroups(imageId);
    removeAlignmentsForImage(imageId);
    removeAnnotationsForImage(imageId);
}
