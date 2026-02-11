// src/lib/strategies/grouping/byVisualProfile.ts
import type { GroupingProposal } from '$lib/domain/grouping/types';
import type { ImageSource } from '$lib/types/project';
import { cosineSimilarity } from '$lib/domain/image/profileSimilarity';

export function groupByVisualProfile(
    images: ImageSource[],
    profiles: Map<string, number[]>,
    threshold: number
): GroupingProposal[] {
    const used = new Set<string>();
    const proposals: GroupingProposal[] = [];

    for (let i = 0; i < images.length; i++) {
        const a = images[i];
        if (used.has(a.id)) continue;

        const pa = profiles.get(a.id);
        if (!pa) continue;

        const group = [a.id];

        for (let j = i + 1; j < images.length; j++) {
            const b = images[j];
            if (used.has(b.id)) continue;

            const pb = profiles.get(b.id);
            if (!pb) continue;

            if (cosineSimilarity(pa, pb) >= threshold) {
                group.push(b.id);
                used.add(b.id);
            }
        }

        if (group.length > 1) {
            group.forEach(id => used.add(id));
            proposals.push({
                id: crypto.randomUUID(),
                imageIds: group,
                reason: `Visual profile ≥ ${Math.round(threshold * 100)}%`
            });
        }
    }

    return proposals;
}
