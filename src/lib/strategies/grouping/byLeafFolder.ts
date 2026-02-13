import type { ImageSource } from '$lib/domain/project/types';
import type { GroupingProposal } from '$lib/domain/grouping/types';

export function groupByLeafFolder(
    images: ImageSource[]
): GroupingProposal[] {

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
