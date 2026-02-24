/**
 * Group Service
 * 
 * Orchestrates grouping workflow.
 * 
 * Responsible for:
 * - Running grouping strategies
 * - Lazy canonical generation if missing
 * - Writing groups to projectStore
 * - Managing group proposals and confirmations
 */

import { get } from 'svelte/store';
import {
    images,
    groups,
    addGroups,
    addImageToGroup,
    removeImageFromGroup,
    updateGroup,
    removeGroup,
    setGroupBaseImage
} from '$lib/core/projectStore';
import {
    regenerateCanonicalNormalised,
    computePHashFromNormalised
} from '$lib/image/derivation';
import { 
    groupByFilename, 
    groupByLeafFolder, 
    groupByPHash, 
    groupByVisualProfile,
    type GroupingProposal
} from '$lib/image/groupingStrategies';
import type { ImageGroup, ImagePreparation } from '$lib/core/types';

/**
 * Apply grouping proposal (all images move into one group).
 */
export function applyGroupingProposal(proposal: GroupingProposal): void {
    if (proposal.imageIds.length === 0) return;

    const affected = new Set(proposal.imageIds);
    const $groups = get(groups);

    // Remove affected images from existing groups
    const updated = $groups
        .map((group) => {
            const remaining = group.imageIds.filter((id) => !affected.has(id));

            if (remaining.length === 0) {
                return null;
            }

            if (remaining.length === group.imageIds.length) {
                return group;
            }

            const [first, ...rest] = remaining;

            return {
                ...group,
                imageIds: [first, ...rest],
                baseImageId: remaining.includes(group.baseImageId)
                    ? group.baseImageId
                    : first
            };
        })
        .filter((g): g is ImageGroup => g !== null);

    // Create new group
    const [first, ...rest] = proposal.imageIds;
    const newGroup: ImageGroup = {
        id: crypto.randomUUID(),
        baseImageId: first,
        imageIds: [first, ...rest],
        locked: false
    };

    // Update store
    addGroups([...updated, newGroup]);
}

/**
 * Split group into individual single-image groups.
 */
export function splitGroup(groupId: string): void {
    const $groups = get(groups);
    const target = $groups.find((g) => g.id === groupId);
    if (!target) return;

    const others = $groups.filter((g) => g.id !== groupId);

    const singles: ImageGroup[] = target.imageIds.map((imageId) => ({
        id: crypto.randomUUID(),
        baseImageId: imageId,
        imageIds: [imageId],
        locked: false
    }));

    addGroups([...others, ...singles]);
}

/**
 * Run filename grouping strategy.
 */
export function runFilenameGrouping(): GroupingProposal[] {
    const $images = get(images);
    return groupByFilename($images);
}

/**
 * Run leaf folder grouping strategy.
 */
export function runLeafFolderGrouping(): GroupingProposal[] {
    const $images = get(images);
    return groupByLeafFolder($images);
}

/**
 * Run perceptual hash grouping strategy.
 * Ensures canonical images exist and perceptual hashes are computed.
 */
export async function runPHashGrouping(threshold: number = 0.85): Promise<GroupingProposal[]> {
    const $images = get(images);

    // Ensure all images have perceptual hashes
    for (const img of $images) {
        if (img.hashes.perceptualHash) continue;

        const prep = img.preparation;
        const hash = img.hashes.contentHash;

        if (!prep) {
            console.warn('Image not prepared, skipping pHash generation:', img.id);
            continue;
        }

        try {
            // Lazy canonical generation
            await regenerateCanonicalNormalised(hash, prep);
            const pHash = await computePHashFromNormalised(hash);

            if (pHash) {
                // Update store with computed hash
                const imageIdx = $images.findIndex((i) => i.id === img.id);
                if (imageIdx !== -1) {
                    $images[imageIdx].hashes.perceptualHash = pHash;
                }
            }
        } catch (err) {
            console.error('Failed to compute pHash:', err);
        }
    }

    return groupByPHash($images, threshold);
}

/**
 * Run visual profile grouping strategy.
 */
export function runVisualProfileGrouping(
    profiles: Map<string, number[]>,
    threshold: number = 0.8
): GroupingProposal[] {
    const $images = get(images);
    return groupByVisualProfile($images, profiles, threshold);
}

/* ============================================================
   Group Mutations
============================================================ */

export function addImageToExistingGroup(
    groupId: string,
    imageId: string
): void {
    addImageToGroup(groupId, imageId);
}

export function removeImageFromExistingGroup(
    groupId: string,
    imageId: string
): void {
    removeImageFromGroup(groupId, imageId);
}

export function updateExistingGroup(
    groupId: string,
    updater: (g: ImageGroup) => ImageGroup
): void {
    updateGroup(groupId, updater);
}

export function deleteGroup(groupId: string): void {
    removeGroup(groupId);
}

export function changeGroupBaseImage(
    groupId: string,
    imageId: string
): void {
    setGroupBaseImage(groupId, imageId);
}
