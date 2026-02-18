import { groups } from './projectStore';
import type { ImageGroup } from './types';

export function removeFromGroups(imageId: string) {
    groups.update((list) =>
        list.flatMap((g) => {
            const remaining = g.imageIds.filter(
                (id) => id !== imageId
            );

            // If no images remain, delete the group entirely
            if (remaining.length === 0) {
                return [];
            }

            const tupleIds = remaining as [string, ...string[]];

            return [
                {
                    ...g,
                    imageIds: tupleIds,
                    baseImageId:
                        g.baseImageId === imageId
                            ? tupleIds[0]
                            : g.baseImageId
                }
            ];
        })
    );
}


import { alignments } from './projectStore';

export function removeAlignments(imageId: string) {
    alignments.update((list) =>
        list.filter(
            (a) =>
                a.sourceImageId !== imageId &&
                a.targetImageId !== imageId
        )
    );
}

import { annotations, images } from './projectStore';
import { get } from 'svelte/store';

export function removeAnnotations(imageId: string) {
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
