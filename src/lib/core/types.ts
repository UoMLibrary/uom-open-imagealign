/* THIS FILE IS AUTO-GENERATED — DO NOT EDIT MANUALLY */

export interface ImageAlignmentProject {
  version: string;
  createdAt: string;
  updatedAt?: string;
  /**
   * Config describing the expected cached artefacts (IndexedDB keys include these sizes/versions).
   */
  derivations?: {
    work?: DerivationSpec;
    thumb?: DerivationSpec;
  };
  /**
   * @minItems 0
   */
  images: ImageRecord[];
  /**
   * @minItems 0
   */
  groups: ImageGroup[];
  /**
   * @minItems 0
   */
  alignments: ImageAlignment[];
  /**
   * @minItems 0
   */
  annotations?: AnnotationRecord[];
  notes?: string;
  ui?: ProjectUIState;
}
export interface DerivationSpec {
  kind: 'work' | 'thumb';
  /**
   * Square output dimension in pixels (e.g. 2048, 256).
   */
  size: number;
  /**
   * Bump when derivation algorithm changes (part of cache key).
   */
  version: string;
}
export interface ImageRecord {
  /**
   * Unique ID for this image instance in the project (duplicates may share the same contentHash).
   */
  id: string;
  /**
   * Hash of the underlying image bytes, used to dedupe cached blobs in IndexedDB.
   */
  contentHash: string;
  label?: string;
  /**
   * Optional logical path / folder path to preserve structure in UI.
   */
  structuralPath?: string;
  dimensions: Dimensions;
  metadata?: {
    [k: string]: unknown;
  };
}
/**
 * Original source image dimensions (not the derived work/thumb sizes).
 */
export interface Dimensions {
  width: number;
  height: number;
}
export interface ImageGroup {
  id: string;
  /**
   * The base/reference image for this group.
   */
  baseImageId: string;
  /**
   * All image instance IDs in the group (should include the baseImageId).
   *
   * @minItems 1
   */
  imageIds: [string, ...string[]];
  locked: boolean;
}
export interface ImageAlignment {
  id: string;
  groupId: string;
  /**
   * The image that served as the *source* when computing the transform. In
   * many parts of the UI this is referred to as the "base" image, but the
   * store and workspace code operate in terms of source/target nomenclature.
   */
  sourceImageId: string;
  /**
   * The image that is being aligned *to* the source.
   */
  targetImageId: string;
  /**
   * Alignment method identifier (e.g. 'manual', 'auto', future methods).
   */
  method: string;
  confidence?: number;
  transform: AlignmentTransform;
  /**
   * Method-specific data sufficient to reproduce alignment against cached work images.
   */
  methodData:
    | ManualMethodData
    | AutoMethodData
    | {
        [k: string]: unknown;
      };
}
export interface AlignmentTransform {
  type: 'affine' | 'homography';
  /**
   * 3x3 row-major matrix.
   *
   * @minItems 9
   * @maxItems 9
   */
  matrix: [number, number, number, number, number, number, number, number, number];
}
export interface ManualMethodData {
  type: 'manual';
  /**
   * @minItems 1
   */
  points: [ManualPointPair, ...ManualPointPair[]];
}
export interface ManualPointPair {
  base: Pt01;
  compared: Pt01;
}
export interface Pt01 {
  x: number;
  y: number;
}
export interface AutoMethodData {
  type: 'auto';
  [k: string]: unknown;
}
export interface AnnotationRecord {
  id: string;
  groupId: string;
  baseImageId: string;
  comparedImageId: string;
  /**
   * Optional link to the alignment used when the annotation was created.
   */
  alignmentId?: string;
  /**
   * Opaque, organisation-configurable annotation payload.
   */
  data: {
    [k: string]: unknown;
  };
}
export interface ProjectUIState {
  lastSelectedImageId?: string;
  lastSelectedGroupId?: string;
  lastMode?: 'ingest' | 'group' | 'align' | 'annotate' | 'output';
  SidePanelOpen?: boolean;
}
