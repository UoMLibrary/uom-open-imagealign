import { writable, derived, get } from 'svelte/store';
import type {
    ImageAlignmentProject as Project,
    ImageSource,
    ImageGroup,
    ImageAlignment
} from '$lib/types/project';

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
export const annotations = writable<Project['annotations'] | null>(null);

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
        if (!$annotations) return 'none';

        const match = $images.find(
            img => img.hashes.contentHash === $annotations.imageContentHash
        );

        return match ? 'valid' : 'mismatch';
    }
);

/* ---------------------------------------------
   Project assembly (for saving)
--------------------------------------------- */

export const project = derived(
    [projectMeta, images, groups, alignments, annotations],
    ([$meta, $images, $groups, $alignments, $annotations]): Project | null => {
        if ($images.length === 0) return null;

        return {
            version: $meta.version,
            createdAt: $meta.createdAt,
            images: $images as [ImageSource, ...ImageSource[]],
            groups: $groups,
            alignments: $alignments,
            notes: $meta.notes,
            annotations: $annotations ?? undefined
        };
    }
);


/* ---------------------------------------------
   Store actions (the ONLY way to mutate state)
--------------------------------------------- */

export function resetProject() {
    projectMeta.set({
        version: '0.2',
        createdAt: new Date().toISOString()
    });

    images.set([]);
    groups.set([]);
    alignments.set([]);
    annotations.set(null);
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
            uri: '' // 🔑 unlinked by definition
        }))
    );

    groups.set(p.groups);
    alignments.set(p.alignments);
    annotations.set(p.annotations ?? null);
}


export function addImage(image: ImageSource) {
    images.update(imgs => [...imgs, image]);
}

export function updateGroup(groupId: string, updater: (g: ImageGroup) => ImageGroup) {
    groups.update(gs =>
        gs.map(g => (g.id === groupId ? updater(g) : g))
    );
}

export function addAlignment(alignment: ImageAlignment) {
    alignments.update(a => [...a, alignment]);
}

export function setAnnotations(data: Project['annotations']) {
    annotations.set(data);
}

/* ---------------------------------------------
   Image lookup & relinking helpers
--------------------------------------------- */

export function findImageByContentHash(
    contentHash: string
): ImageSource | undefined {
    return get(images).find(
        (img) => img.hashes.contentHash === contentHash
    );
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

/**
 * Convenience helper:
 * - updates existing image if hash matches
 * - otherwise inserts new image
 */
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

export const linkedImagesByHash = derived(images, ($images) =>
    new Set(
        $images
            .filter((img) => img.uri && img.uri.length > 0)
            .map((img) => img.hashes.contentHash)
    )
);
