// src/lib/core/workflow.ts

import { images } from './projectStore';
import {
    removeFromAllGroups,
    removeAlignmentsForImage,
    removeAnnotationsForImage
} from './projectStore';

import type { ImageSource } from './types'; // <-- generated from schema

/* -------------------------------------------------
   Workflow Stage Type (Derived from Schema)
------------------------------------------------- */

// image.workflow.stage from schema
export type WorkflowStage = NonNullable<
    ImageSource['workflow']
>['stage'];

/* -------------------------------------------------
   Stage Order (Domain Logic – Not Schema)
------------------------------------------------- */

// Order matters for progression logic.
// Schema defines allowed values.
// This defines progression semantics.
export const STAGE_ORDER: WorkflowStage[] = [
    'ingested',
    'dewarped',
    'grouped',
    'aligned',
    'annotated',
    'prepared'
];

/* -------------------------------------------------
   Stage Update
------------------------------------------------- */

export function setImageStage(
    imageId: string,
    newStage: WorkflowStage
) {
    images.update((list) =>
        list.map((img) =>
            img.id === imageId
                ? {
                    ...img,
                    workflow: {
                        stage: newStage,
                        updatedAt: new Date().toISOString()
                    }
                }
                : img
        )
    );

    invalidateDownstream(imageId, newStage);
}

/* -------------------------------------------------
   Invalidation Logic
------------------------------------------------- */

function invalidateDownstream(
    imageId: string,
    stage: WorkflowStage
) {
    const index = STAGE_ORDER.indexOf(stage);

    if (index <= STAGE_ORDER.indexOf('prepared')) {
        removeFromAllGroups(imageId);
        removeAlignmentsForImage(imageId);
        removeAnnotationsForImage(imageId);
        return;
    }

    if (index <= STAGE_ORDER.indexOf('grouped')) {
        removeAlignmentsForImage(imageId);
        removeAnnotationsForImage(imageId);
        return;
    }

    if (index <= STAGE_ORDER.indexOf('aligned')) {
        removeAnnotationsForImage(imageId);
    }
}

/* -------------------------------------------------
   Stage Comparison Helpers
------------------------------------------------- */

export function isStageAtOrBeyond(
    imageStage: WorkflowStage,
    requiredStage: WorkflowStage
): boolean {
    return (
        STAGE_ORDER.indexOf(imageStage) >=
        STAGE_ORDER.indexOf(requiredStage)
    );
}