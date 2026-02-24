import { writable, get } from 'svelte/store';
import type { ImageGroup } from './types';
import { images } from './projectStore';

export interface GroupingProposal {
	id: string;
	imageIds: string[];
	reason?: string;
	confidence?: number;
}

export interface GroupingProposals {
	proposals: GroupingProposal[];
	selected: Set<string>;
}

export const groupingState = writable<GroupingProposals>({
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
