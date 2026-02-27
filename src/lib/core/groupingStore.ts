// src/lib/core/groupingStore.ts
import { writable, get } from 'svelte/store';
import type { ImageGroup } from './types';
import { images, addGroup, removeFromAllGroups } from './projectStore';

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

/* -------------------------------------------------
   ID helper
------------------------------------------------- */

function uid(prefix = 'id') {
	// Browser-safe, but also works in most runtimes
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return `${prefix}_${crypto.randomUUID()}`;
	}
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/* -------------------------------------------------
   Initial state
------------------------------------------------- */

export function initialiseSingleImageProposals() {
	const imgs = get(images);
	if (imgs.length === 0) return;

	groupingState.update((state) => {
		// Only initialise if empty
		if (state.proposals.length > 0) return state;

		const proposals: GroupingProposal[] = imgs.map((img) => ({
			id: `single_${img.id}`,
			imageIds: [img.id],
			reason: 'Initial state',
			confidence: 1
		}));

		return { ...state, proposals };
	});
}

/* -------------------------------------------------
   Proposal utilities
------------------------------------------------- */

export function discardProposal(proposalId: string) {
	groupingState.update((state) => {
		const proposals = state.proposals.filter((p) => p.id !== proposalId);
		return { ...state, proposals };
	});
}

export function ensureSingleImageProposal(imageId: string, reason = 'Split from suggestion') {
	groupingState.update((state) => {
		const alreadyExists = state.proposals.some(
			(p) => p.imageIds.length === 1 && p.imageIds[0] === imageId
		);

		if (alreadyExists) return state;

		const proposal: GroupingProposal = {
			id: `single_${imageId}`,
			imageIds: [imageId],
			reason,
			confidence: 1
		};

		return {
			...state,
			proposals: [...state.proposals, proposal]
		};
	});
}

export function ungroupImageFromProposal(proposalId: string, imageId: string) {
	groupingState.update((state) => {
		const target = state.proposals.find((p) => p.id === proposalId);
		if (!target) return state;
		if (!target.imageIds.includes(imageId)) return state;

		const proposals: GroupingProposal[] = [];

		for (const p of state.proposals) {
			if (p.id !== proposalId) {
				proposals.push(p);
				continue;
			}

			const remaining = p.imageIds.filter((id) => id !== imageId);

			// If nothing left, drop the proposal
			if (remaining.length === 0) continue;

			proposals.push({
				...p,
				imageIds: remaining,
				// Optional: tweak the reason so it’s obvious this was edited
				reason: p.reason ? `${p.reason} (manually edited)` : 'Manually edited'
			});
		}

		return {
			...state,
			proposals
		};
	});

	// Make the removed image its own group-of-one proposal (if not already)
	ensureSingleImageProposal(imageId);
}

/**
 * Optional convenience:
 * Confirm a proposal into the *project* groups store, and remove overlapping proposals.
 * If your ImageGroup type later gains required fields, add them here.
 */
export function confirmProposalAsGroup(proposalId: string) {
	const state = get(groupingState);
	const proposal = state.proposals.find((p) => p.id === proposalId);
	if (!proposal) return;

	const imageIds = Array.from(new Set(proposal.imageIds));
	if (imageIds.length === 0) return;

	// Ensure these images aren't already inside other groups
	for (const id of imageIds) removeFromAllGroups(id);

	const group: ImageGroup = {
		id: uid('group'),
		baseImageId: imageIds[0],
		imageIds
	} as unknown as ImageGroup;

	addGroup(group);

	// Remove this proposal + any other proposals that overlap these images (keeps suggestions tidy)
	groupingState.update((s) => {
		const proposals = s.proposals.filter((p) => !p.imageIds.some((id) => imageIds.includes(id)));
		const selected = new Set([...s.selected].filter((id) => !imageIds.includes(id)));
		return { ...s, proposals, selected };
	});
}