// src/lib/stores/groupingStore.ts
import { writable } from 'svelte/store';
import type { GroupingProposal } from './types';

export const groupingState = writable<{
    proposals: GroupingProposal[];
    selected: Set<string>;
}>({
    proposals: [],
    selected: new Set()
});
