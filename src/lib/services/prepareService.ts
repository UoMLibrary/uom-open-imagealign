/**
 * Prepare Service
 * 
 * Orchestrates image preparation workflow.
 * 
 * Responsible for:
 * - Confirming image preparation (rotation + crop)
 * - Regenerating derived artefacts (prepared working, canonical)
 * - Computing perceptual hash
 * - Updating workflow stage
 * - Invalidating downstream data (groups, alignments, annotations)
 */

import { get } from 'svelte/store';
import {
    images,
    updateImage,
    removeFromAllGroups,
    removeAlignmentsForImage,
    removeAnnotationsForImage
} from '$lib/core/projectStore';
import {
    regeneratePreparedWorking,
    regenerateCanonicalNormalised,
    invalidatePrepared,
    computePHashFromNormalised
} from '$lib/image/derivation';
import type { ImagePreparation } from '$lib/core/types';

const STAGES = [
    "ingested",
    "prepared",
    "grouped",
    "aligned",
    "annotated"
] as const;

export type WorkflowStage = typeof STAGES[number];

/**
 * Confirm image preparation (geometry after rotation/crop).
 * 
 * This triggers regeneration of all derived artefacts and
 * invalidates downstream pipeline (grouping, alignment, annotations).
 */
export async function confirmPreparation(
    imageIds: string[],
    preparation: ImagePreparation
): Promise<void> {
    const $images = get(images);

    for (const imageId of imageIds) {
        const image = $images.find((img) => img.id === imageId);
        if (!image) continue;

        const contentHash = image.hashes.contentHash;

        /* 1. Update metadata immediately */
        updateImage(imageId, (img) => ({
            ...img,
            preparation,
            workflow: {
                stage: "prepared",
                updatedAt: new Date().toISOString()
            }
        }));

        /* 2. Invalidate old derived artefacts */
        await invalidatePrepared(contentHash);

        /* 3. Regenerate prepared working image */
        await regeneratePreparedWorking(contentHash, preparation);

        /* 4. Regenerate canonical 512px grayscale */
        await regenerateCanonicalNormalised(contentHash, preparation);

        /* 5. Compute perceptual hash from canonical */
        const perceptualHash = await computePHashFromNormalised(contentHash);

        /* 6. Persist perceptual hash into store */
        updateImage(imageId, (img) => ({
            ...img,
            hashes: {
                ...img.hashes,
                perceptualHash
            }
        }));

        /* 7. Invalidate downstream pipeline */
        invalidateDownstream(imageId, "prepared");
    }
}

/**
 * Update image workflow stage and cascade invalidation.
 */
export function setImageStage(imageId: string, newStage: WorkflowStage): void {
    updateImage(imageId, (img) => ({
        ...img,
        workflow: {
            stage: newStage,
            updatedAt: new Date().toISOString()
        }
    }));

    invalidateDownstream(imageId, newStage);
}

/**
 * Remove downstream pipeline data when backtracking to earlier stage.
 */
function invalidateDownstream(imageId: string, stage: WorkflowStage): void {
    const index = STAGES.indexOf(stage);

    // Dropping to prepared removes grouping + alignment + annotations
    if (index <= STAGES.indexOf("prepared")) {
        removeFromAllGroups(imageId);
        removeAlignmentsForImage(imageId);
        removeAnnotationsForImage(imageId);
    }

    if (index <= STAGES.indexOf("grouped")) {
        removeAlignmentsForImage(imageId);
        removeAnnotationsForImage(imageId);
    }

    if (index <= STAGES.indexOf("aligned")) {
        removeAnnotationsForImage(imageId);
    }
}
