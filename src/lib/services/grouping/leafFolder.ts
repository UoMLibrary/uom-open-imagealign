import type { ImageSource } from '$lib/core/types';
import type { GroupingProposal } from './types';

/**
 * Group by Leaf Folder
 * Groups images that share the same immediate parent directory.
 */
export function groupByLeafFolder(images: ImageSource[]): GroupingProposal[] {
    const folderMap = new Map<string, string[]>();

    for (const img of images) {
        if (!img.structuralPath) continue;

        const parts = img.structuralPath.split('/').filter(Boolean);
        if (parts.length < 2) continue;

        const folder = parts.slice(0, -1).join('/');

        if (!folderMap.has(folder)) {
            folderMap.set(folder, []);
        }

        folderMap.get(folder)!.push(img.id);
    }

    return [...folderMap.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([folder, imageIds]) => ({
            id: crypto.randomUUID(),
            imageIds,
            reason: `Leaf folder: ${folder}`
        }));
}
