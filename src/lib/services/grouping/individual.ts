import type { ImageSource } from '$lib/core/types';
import type { GroupingProposal } from './types';

/**
 * Group by Individual Image
 * Creates one group per image - useful as a baseline.
 */
export function groupByIndividual(images: ImageSource[]): GroupingProposal[] {
    return images.map((img) => ({
        id: crypto.randomUUID(),
        imageIds: [img.id],
        reason: `Individual: ${img.label || 'Unnamed'}`
    }));
}
