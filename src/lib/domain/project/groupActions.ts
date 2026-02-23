// $lib/domain/project/groupActions.ts

import { get } from 'svelte/store';
import { groups, images } from './projectStore';
import type { ImageGroup } from './types';
import type { GroupingProposal } from '$lib/domain/grouping/types';

export function splitGroup(groupId: string) {
    groups.update((current) => {
        const target = current.find((g) => g.id === groupId);
        if (!target) return current;

        const others = current.filter((g) => g.id !== groupId);

        const singles: ImageGroup[] = target.imageIds.map((imageId) => ({
            id: crypto.randomUUID(),
            baseImageId: imageId,
            imageIds: [imageId],
            locked: false
        }));

        return [...others, ...singles];
    });
}



export function applyGroupingProposal(proposal: GroupingProposal) {
    const affected = new Set(proposal.imageIds);

    groups.update((current) => {
        const updated: ImageGroup[] = [];

        for (const group of current) {
            const remaining = group.imageIds.filter(
                (id) => !affected.has(id)
            );

            if (remaining.length > 0) {
                const [first, ...rest] = remaining;

                updated.push({
                    ...group,
                    imageIds: [first, ...rest],
                    baseImageId:
                        remaining.includes(group.baseImageId)
                            ? group.baseImageId
                            : first
                });
            }
        }

        if (proposal.imageIds.length === 0) {
            return current;
        }

        const [first, ...rest] = proposal.imageIds;

        const newGroup: ImageGroup = {
            id: crypto.randomUUID(),
            baseImageId: first,
            imageIds: [first, ...rest],
            locked: false
        };

        return [...updated, newGroup];
    });
}


