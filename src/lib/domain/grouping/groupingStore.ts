// src/lib/domain/grouping/groupingStore.ts

import { writable, get } from 'svelte/store';
import type { GroupingProposal } from './types';
import { images } from '$lib/domain/project/projectStore';

export const groupingState = writable<{
    proposals: GroupingProposal[];
    selected: Set<string>;
}>({
    proposals: [],
    selected: new Set()
});

export function initialiseSingleImageProposals() {
    const imgs = get(images);

    if (imgs.length === 0) return;

    groupingState.update((state) => {
        // Only initialise if empty
        if (state.proposals.length > 0) return state;

        const proposals: GroupingProposal[] = imgs.map((img) => ({
            id: img.id,
            imageIds: [img.id],
            reason: 'Initial state',
            confidence: 1
        }));

        return {
            ...state,
            proposals
        };
    });
}