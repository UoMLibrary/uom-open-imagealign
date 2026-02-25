// src/lib/core/workflow.ts

import { images } from './projectStore';
import {
    removeFromAllGroups,
    removeAlignmentsForImage,
    removeAnnotationsForImage
} from './projectStore';

export const STAGES = [
    'ingested',
    'prepared',
    'grouped',
    'aligned',
    'annotated'
] as const;

export type WorkflowStage = typeof STAGES[number];

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

function invalidateDownstream(
    imageId: string,
    stage: WorkflowStage
) {
    const index = STAGES.indexOf(stage);

    // Dropping to ingested or prepared removes everything downstream
    if (index <= STAGES.indexOf('prepared')) {
        removeFromAllGroups(imageId);
        removeAlignmentsForImage(imageId);
        removeAnnotationsForImage(imageId);
        return;
    }

    if (index <= STAGES.indexOf('grouped')) {
        removeAlignmentsForImage(imageId);
        removeAnnotationsForImage(imageId);
        return;
    }

    if (index <= STAGES.indexOf('aligned')) {
        removeAnnotationsForImage(imageId);
    }
}