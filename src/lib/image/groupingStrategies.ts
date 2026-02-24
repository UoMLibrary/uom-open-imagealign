/**
 * Grouping Strategies
 * 
 * Consolidates all image grouping algorithms.
 * Used by groupService to generate proposals.
 */

import type { ImageSource } from '$lib/core/types';
import { phashSimilarity } from './phashSimilarity';
import { cosineSimilarity } from './profileSimilarity';

export interface GroupingProposal {
    id: string;
    imageIds: string[];
    confidence?: number;
    reason?: string;
}

/* ============================================================
   BY FILENAME
============================================================ */

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

/* ============================================================
   BY LEAF FOLDER
============================================================ */

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

/* ============================================================
   BY PERCEPTUAL HASH
============================================================ */

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

/* ============================================================
   BY VISUAL PROFILE
============================================================ */

export function groupByVisualProfile(
    images: ImageSource[],
    profiles: Map<string, number[]>,
    threshold: number = 0.8
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
