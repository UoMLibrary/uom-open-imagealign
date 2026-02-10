// src/lib/stores/groupingStore.ts
import { writable } from 'svelte/store';
import type { GroupingProposal } from '$lib/types/grouping';

export const groupingState = writable<{
    proposals: GroupingProposal[];
    selected: Set<string>;
}>({
    proposals: [],
    selected: new Set()
});
