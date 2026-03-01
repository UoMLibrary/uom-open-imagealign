/* THIS FILE IS AUTO-GENERATED — DO NOT EDIT MANUALLY */

export type ImageSource = {
  [k: string]: unknown;
} & {
  [k: string]: unknown;
} & {
  [k: string]: unknown;
} & {
  id: string;
  sourceType: 'local' | 'url' | 'iiif';
  source: {
    /**
     * Canonical source URI (remote URL or IIIF endpoint)
     */
    uri?: string;
    /**
     * IIIF base service URL (if sourceType is iiif)
     */
    iiifService?: string;
  };
  label?: string;
  structuralPath?: string;
  hashes: {
    contentHash: string;
    perceptualHash?: string;
  };
  dimensions: {
    width: number;
    height: number;
  };
  metadata?: {
    [k: string]: unknown;
  };
  preparation?: ImagePreparation;
  workflow: ImageWorkflow;
} & {
  id: string;
  sourceType: 'local' | 'url' | 'iiif';
  source: {
    /**
     * Canonical source URI (remote URL or IIIF endpoint)
     */
    uri?: string;
    /**
     * IIIF base service URL (if sourceType is iiif)
     */
    iiifService?: string;
  };
  label?: string;
  structuralPath?: string;
  hashes: {
    contentHash: string;
    perceptualHash?: string;
  };
  dimensions: {
    width: number;
    height: number;
  };
  metadata?: {
    [k: string]: unknown;
  };
  preparation?: ImagePreparation;
  workflow: ImageWorkflow;
};

export interface ImageAlignmentProject {
  version: string;
  createdAt: string;
  /**
   * @minItems 1
   */
  images: [ImageSource, ...ImageSource[]];
  groups: ImageGroup[];
  alignments: ImageAlignment[];
  notes?: string;
  annotations?: {
    baseImageContentHash: string;
    comparedImageContentHash?: string;
    alignmentId?: string;
    data: {
      [k: string]: unknown;
    };
  }[];
  ui?: ProjectUIState;
}
export interface ImagePreparation {
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation: number;
}
export interface ImageWorkflow {
  stage: 'ingested' | 'dewarped' | 'grouped' | 'aligned' | 'annotated' | 'prepared';
  updatedAt?: string;
}
export interface ImageGroup {
  id: string;
  baseImageId: string;
  /**
   * @minItems 1
   */
  imageIds: [string, ...string[]];
  locked: boolean;
}
export interface ImageAlignment {
  sourceImageId: string;
  targetImageId: string;
  sourceContentHash: string;
  targetContentHash: string;
  confidence: number;
  method: string;
  methodData?: {
    [k: string]: unknown;
  };
  transform: {
    type: 'affine' | 'homography';
    /**
     * @minItems 9
     * @maxItems 9
     */
    matrix: [number, number, number, number, number, number, number, number, number];
  };
}
export interface ProjectUIState {
  lastSelectedImageId?: string;
  lastSelectedGroupId?: string;
  lastMode?: 'prepare' | 'group' | 'align' | 'annotate';
  SidePanelOpen?: boolean;
}
