import { writable, derived, get } from 'svelte/store';

export const EMPTY_PROJECT = {
    id: null,
    name: null,
    imagePairs: []
};

export const projectStore = writable(EMPTY_PROJECT);
export const selectedPairId = writable(null);

export const activePair = derived(
    [projectStore, selectedPairId],
    ([$project, $id]) => {
        if (!$project || !$id) return null;
        return $project.imagePairs.find((p) => p.id === $id) ?? null;
    }
);

/**
 * Remove runtime-only fields before saving
 */
export function serialiseProject(project) {
    return {
        ...project,
        imagePairs: project.imagePairs.map(
            ({ imageAUrl, imageBUrl, ...rest }) => rest
        )
    };
}

/**
 * Revoke blob URLs when unloading a project
 */
export function cleanupProject(project) {
    project.imagePairs.forEach((p) => {
        revoke(p.imageAUrl);
        revoke(p.imageBUrl);
        revoke(p.thumbAUrl);
    });
}

function revoke(url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}
