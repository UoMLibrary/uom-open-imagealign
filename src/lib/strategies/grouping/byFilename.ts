import type { ImageSource } from '$lib/types/project';

export function groupByFilename(
    images: ImageSource[]
) {
    const buckets = new Map<string, string[]>();

    for (const img of images) {
        const stem = img.uri
            .split('/')
            .pop()!
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
