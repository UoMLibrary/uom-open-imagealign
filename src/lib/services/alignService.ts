/**
 * Align Service
 * 
 * Orchestrates alignment workflow.
 * 
 * Responsible for:
 * - Ensuring prepared images exist
 * - Running alignment logic
 * - Writing alignments to store
 */

import { get } from 'svelte/store';
import {
    images,
    addAlignment,
    removeAlignmentsForImage
} from '$lib/core/projectStore';
import { regeneratePreparedWorking, ensureWorkingImage } from '$lib/image/derivation';
import type { ImageAlignment, ImagePreparation } from '$lib/core/types';

/**
 * Ensure a specific image has a prepared working image
 * (rotated + cropped based on preparation metadata).
 */
export async function ensurePreparedImage(
    imageId: string,
    preparation: ImagePreparation
): Promise<void> {
    const $images = get(images);
    const image = $images.find((img) => img.id === imageId);

    if (!image) {
        throw new Error(`Image not found: ${imageId}`);
    }

    const contentHash = image.hashes.contentHash;

    // Ensure working image exists first
    try {
        await ensureWorkingImage(contentHash, new File([], 'dummy'));
    } catch (err) {
        console.warn('Working image might not be cached:', err);
    }

    // Regenerate prepared image based on preparation
    await regeneratePreparedWorking(contentHash, preparation);
}

/**
 * Record an alignment between two images.
 */
export function recordAlignment(alignment: ImageAlignment): void {
    addAlignment(alignment);
}

/**
 * Remove all alignments for an image.
 */
export function clearImageAlignments(imageId: string): void {
    removeAlignmentsForImage(imageId);
}

/**
 * Get alignments for a specific source image.
 */
export function getAlignmentsForImage(imageId: string): ImageAlignment[] {
    const $images = get(images);
    const image = $images.find((img) => img.id === imageId);

    if (!image) return [];

    // This would normally be done via a derived store in the component
    // For now, just return empty - the component should use the store directly
    return [];
}
