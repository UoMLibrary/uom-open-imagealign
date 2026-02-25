import type { ImageSource } from '$lib/core/types';
import { phashSimilarity } from '$lib/image/phashSimilarity';
import type { GroupingProposal } from './types';

/**
 * Group by Perceptual Hash Similarity
 * Groups images with visually similar perceptual hashes.
 */
export function groupByPHash(
    images: ImageSource[],
    threshold: number = 0.85
): GroupingProposal[] {
    const used = new Set<string>();
    const proposals: GroupingProposal[] = [];

    for (let i = 0; i < images.length; i++) {
        const a = images[i];
        if (!a.hashes.perceptualHash || used.has(a.id)) continue;

        const group = [a.id];

        for (let j = i + 1; j < images.length; j++) {
            const b = images[j];
            if (!b.hashes.perceptualHash || used.has(b.id)) continue;

            const similarity = phashSimilarity(
                a.hashes.perceptualHash,
                b.hashes.perceptualHash
            );

            if (similarity >= threshold) {
                group.push(b.id);
                used.add(b.id);
            }
        }

        if (group.length > 1) {
            group.forEach(id => used.add(id));

            proposals.push({
                id: crypto.randomUUID(),
                imageIds: group,
                confidence: threshold,
                reason: `pHash ≥ ${Math.round(threshold * 100)}%`
            });
        }
    }

    return proposals;
}
