import { writable, derived, get } from 'svelte/store';
import type {
    ImageAlignmentProject as Project,
    ImageSource,
    ImageGroup,
    ImageAlignment,
    ImagePreparation,
    ProjectUIState
} from '$lib/domain/project/types';
import { invalidateDownstream } from './workflow';

/* ---------------------------------------------
   Core writable stores (authoritative state)
--------------------------------------------- */

export const projectMeta = writable<{
    version: Project['version'];
    createdAt: string;
    notes?: string;
}>({
    version: '0.2',
    createdAt: new Date().toISOString()
});

export const images = writable<ImageSource[]>([]);
export const groups = writable<ImageGroup[]>([]);
export const alignments = writable<ImageAlignment[]>([]);
export const annotations = writable<Project['annotations']>([]);
export const projectUI = writable<ProjectUIState | undefined>(undefined);

/* ---------------------------------------------
   Derived stores (read-only, computed)
--------------------------------------------- */

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

/* ---------------------------------------------
   Annotation validation status
--------------------------------------------- */

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

/* ---------------------------------------------
   Project assembly (for saving)
--------------------------------------------- */

export const project = derived(
    [projectMeta, images, groups, alignments, annotations, projectUI],
    ([$meta, $images, $groups, $alignments, $annotations, $ui]): Project | null => {
        if ($images.length === 0) return null;

        return {
            version: $meta.version,
            createdAt: $meta.createdAt,
            images: $images as [ImageSource, ...ImageSource[]],
            groups: $groups,
            alignments: $alignments,
            notes: $meta.notes,
            annotations: $annotations.length ? $annotations : undefined,
            ui: $ui && Object.keys($ui).length > 0 ? $ui : undefined
        };
    }
);

/* ---------------------------------------------
   Store actions (ONLY way to mutate state)
--------------------------------------------- */

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

export function loadProject(p: Project) {
    projectMeta.set({
        version: p.version,
        createdAt: p.createdAt,
        notes: p.notes
    });

    images.set(
        p.images.map((img) => ({
            ...img,
            uri: '' // unlinked by definition
        }))
    );

    groups.set(p.groups);
    alignments.set(p.alignments);
    annotations.set(p.annotations ?? []);
    projectUI.set(p.ui);
}

/* ---------------------------------------------
   UI state mutation
--------------------------------------------- */

export function updateProjectUI(
    partial: Partial<ProjectUIState>
) {
    projectUI.update((current) => ({
        ...current,
        ...partial
    }));
}

/* ---------------------------------------------
   Image mutations
--------------------------------------------- */

export function addImage(image: ImageSource) {
    images.update(imgs => [...imgs, image]);
}

export function updateImagePreparation(
    imageId: string,
    preparation: ImagePreparation
) {
    images.update((list) =>
        list.map((img) => {
            if (img.id !== imageId) return img;

            return {
                ...img,
                preparation,
                workflow: {
                    stage: "prepared",
                    updatedAt: new Date().toISOString()
                }
            };
        })
    );

    invalidateDownstream(imageId, "prepared");
}

export function updateImageByContentHash(
    contentHash: string,
    updater: (img: ImageSource) => ImageSource
) {
    images.update((list) => {
        const idx = list.findIndex(
            (img) => img.hashes.contentHash === contentHash
        );

        if (idx === -1) return list;

        const next = [...list];
        next[idx] = updater(next[idx]);
        return next;
    });
}

export function upsertImageByContentHash(
    contentHash: string,
    create: () => ImageSource,
    update: (img: ImageSource) => ImageSource
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
): ImageSource | undefined {
    return get(images).find(
        (img) => img.hashes.contentHash === contentHash
    );
}

/* ---------------------------------------------
   Groups
--------------------------------------------- */

export function addGroup(group: ImageGroup) {
    groups.update(gs => [...gs, group]);
}

export function addGroups(newGroups: ImageGroup[]) {
    groups.update(gs => [...gs, ...newGroups]);
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

export function addImageToGroup(
    groupId: string,
    imageId: string
) {
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

export function removeImageFromGroup(
    groupId: string,
    imageId: string
) {
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

export function setGroupBaseImage(
    groupId: string,
    imageId: string
) {
    groups.update((gs) =>
        gs.map((g) =>
            g.id === groupId && g.imageIds.includes(imageId)
                ? { ...g, baseImageId: imageId }
                : g
        )
    );
}

/* ---------------------------------------------
   Alignments
--------------------------------------------- */

export function addAlignment(alignment: ImageAlignment) {
    alignments.update(a => [...a, alignment]);
}

/* ---------------------------------------------
   Annotations
--------------------------------------------- */

export function addAnnotation(annotation: Project['annotations'][number]) {
    annotations.update(list => [...list, annotation]);
}

export function replaceAnnotations(next: Project['annotations']) {
    annotations.set(next);
}

/* ---------------------------------------------
   Helpers
--------------------------------------------- */

export const linkedImagesByHash = derived(images, ($images) =>
    new Set(
        $images
            .filter((img) => img.uri && img.uri.length > 0)
            .map((img) => img.hashes.contentHash)
    )
);
