// src/lib/migration/migrateProject.ts

import type { ImageAlignmentProject as Project } from '$lib/types/project';

type AnyProject = Record<string, any>;
type Migrator = (input: AnyProject) => AnyProject;

/**
 * Registry of migrations.
 * Each function upgrades FROM the key version TO the next version.
 */
const migrations: Record<string, Migrator> = {
    '0.1': migrate_0_1_to_0_2
};

/**
 * Public entry point.
 * Always returns a project in the latest supported shape.
 */
export function migrateProject(input: AnyProject): Project {
    let current = structuredClone(input);

    // If version is missing, assume earliest
    if (!current.version) {
        current.version = '0.1';
    }

    while (migrations[current.version]) {
        current = migrations[current.version](current);
    }

    return current as Project;
}

/* ---------------------------------------------
   Individual migrations
--------------------------------------------- */

/**
 * 0.1 → 0.2
 *
 * - Introduces structured annotations object
 * - Leaves everything else untouched
 */
function migrate_0_1_to_0_2(old: AnyProject): AnyProject {
    return {
        ...old,
        version: '0.2',

        annotations: old.annotations
            ? [
                {
                    baseImageContentHash:
                        old.annotations.imageContentHash ?? '',
                    data:
                        old.annotations.data ?? old.annotations
                }
            ]
            : undefined
    };
}
