import { images, groups, alignments, annotations } from './projectStore';
import {
    removeFromGroups,
    removeAlignments,
    removeAnnotations
} from './invalidation';


export const STAGES = [
    "ingested",
    "prepared",
    "grouped",
    "aligned",
    "annotated"
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

export function invalidateDownstream(
    imageId: string,
    stage: WorkflowStage
) {
    const index = STAGES.indexOf(stage);

    // Dropping to prepared removes grouping + alignment + annotations
    if (index <= STAGES.indexOf("prepared")) {
        removeFromGroups(imageId);
        removeAlignments(imageId);
        removeAnnotations(imageId);
    }

    if (index <= STAGES.indexOf("grouped")) {
        removeAlignments(imageId);
        removeAnnotations(imageId);
    }

    if (index <= STAGES.indexOf("aligned")) {
        removeAnnotations(imageId);
    }
}
