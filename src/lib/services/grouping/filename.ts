import type { ImageSource } from '$lib/core/types';
import type { GroupingProposal } from './types';

/**
 * Group by Filename Stem
 * Extracts the filename stem (removing extension and trailing numbers)
 * and groups images with matching stems.
 */
export function groupByFilename(images: ImageSource[]): GroupingProposal[] {
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
