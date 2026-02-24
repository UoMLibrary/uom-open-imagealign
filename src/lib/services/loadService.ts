/**
 * Load Service
 * 
 * Orchestrates project loading workflow.
 * 
 * Responsible for:
 * - Parsing + validating project file
 * - Populating projectStore
 * - Ensuring working + thumbnail images exist
 * - Hydrating runtimeUri from IndexedDB
 * 
 * Does NOT generate canonical or prepared images (lazy generation).
 */

import { migrateProject } from '$lib/infrastructure/migrate';
import { validateProject } from '$lib/infrastructure/validate';
import {
    resetProject,
    setProjectMeta,
    setImages,
    setGroups,
    setAlignments,
    setAnnotations,
    setProjectUI
} from '$lib/core/projectStore';
import { ensureWorkingImage, ensureThumbnail, rehydrateImagesFromCache } from '$lib/image/derivation';
import type { ImageAlignmentProject as Project } from '$lib/core/types';
import type { RuntimeImageSource } from '$lib/core/runtimeTypes';

/**
 * Load and initialize a project from file.
 */
export async function loadProjectFromFile(file: File): Promise<void> {
    const text = await file.text();

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('Invalid JSON file');
    }

    const migrated = migrateProject(parsed);
    const validation = validateProject(migrated);

    if (!validation.valid) {
        console.warn('Project validation warnings:', validation.errors);
    }

    await loadProject(migrated);
}

/**
 * Initialize a project in memory.
 */
export async function loadProject(p: Project): Promise<void> {
    resetProject();

    // Populate metadata
    setProjectMeta({
        version: p.version,
        createdAt: p.createdAt,
        notes: p.notes
    });

    // Initialize images with empty runtimeUri
    const images: RuntimeImageSource[] = p.images.map((img) => ({
        ...img,
        runtimeUri: undefined
    }));

    setImages(images);
    setGroups(p.groups);
    setAlignments(p.alignments);
    setAnnotations(p.annotations ?? []);
    setProjectUI(p.ui);

    // Wait for store updates to propagate
    await Promise.resolve();

    // Load working images from cache into IndexedDB
    // This is required for performance, but not for correctness.
    // If cache is missing, images will be regenerated on demand.
    for (const img of p.images) {
        try {
            // Try to ensure working image exists.
           // This will be a no-op if already cached.
            await ensureThumbnail(img.hashes.contentHash);
        } catch (err) {
            console.warn('Could not ensure thumbnail:', err);
        }
    }

    // Rehydrate runtime URIs from cached working images
    const rehydratedImages = await rehydrateImagesFromCache(images);
    setImages(rehydratedImages);
}

/**
 * Save project to file.
 */
export async function saveProjectToFile(
    project: Project,
    filename: string = 'project.json'
): Promise<void> {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
