import { derived } from 'svelte/store';
import { images, groups } from './projectStore';

/**
 * IDs of images that are not part of any confirmed group.
 */
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
