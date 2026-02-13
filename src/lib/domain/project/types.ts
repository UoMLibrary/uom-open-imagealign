/* THIS FILE IS AUTO-GENERATED — DO NOT EDIT MANUALLY */

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
}
export interface ImageSource {
  id: string;
  sourceType: 'local' | 'url' | 'iiif';
  uri: string;
  structuralPath?: string;
  label?: string;
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
  transform: {
    type: 'affine' | 'homography';
    /**
     * @minItems 9
     * @maxItems 9
     */
    matrix: [number, number, number, number, number, number, number, number, number];
  };
}
