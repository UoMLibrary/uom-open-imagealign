import { derived } from 'svelte/store';
import { images, groups } from '$lib/core/projectStore';
import { groupingState } from '$lib/core/groupingStore';

/**
 * Image IDs that are part of confirmed groups
 */
export const groupedImageIds = derived(groups, ($groups) => {
    const ids = new Set<string>();
    for (const g of $groups) {
        for (const id of g.imageIds) {
            ids.add(id);
        }
    }
    return ids;
});

/**
 * Image IDs that are part of any grouping proposal
 */
export const proposedImageIds = derived(
    groupingState,
    ($grouping) => {
        const ids = new Set<string>();
        for (const p of $grouping.proposals) {
            for (const id of p.imageIds) {
                ids.add(id);
            }
        }
        return ids;
    }
);

/**
 * Image IDs that are neither grouped nor proposed
 */
export const ungroupedImageIds = derived(
    [images, groupedImageIds, proposedImageIds],
    ([$images, $grouped, $proposed]) =>
        $images
            .map((img) => img.id)
            .filter(
                (id) => !$grouped.has(id) && !$proposed.has(id)
            )
);
