import type { ImageSource } from '$lib/types/project';
import type { GroupingProposal } from '$lib/domain/grouping/types';

export function groupByFilename(
    images: ImageSource[]
): GroupingProposal[] {
    const buckets = new Map<string, string[]>();

    for (const img of images) {
        if (!img.label) continue;

        const stem = img.label
            .toLowerCase()
            .replace(/\.(jpg|jpeg|png|tif|tiff)$/i, '')
            .replace(/[_-]?\d+$/, '');

        if (!buckets.has(stem)) buckets.set(stem, []);
        buckets.get(stem)!.push(img.id);
    }

    return [...buckets.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([stem, imageIds]) => ({
            id: crypto.randomUUID(),
            imageIds,
            reason: `Filename stem: ${stem}`
        }));
}
