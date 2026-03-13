/* THIS FILE IS AUTO-GENERATED — DO NOT EDIT MANUALLY */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [k: string]: JsonValue;
    };
export type IdString = string;
export type FieldKey = string;
export type MetadataFieldType = 'string' | 'number' | 'boolean' | 'date' | 'url';
export type ScalarOptionValue = string | number | boolean;
export type AnnotationGeometryType = 'point' | 'rect' | 'polygon' | 'line';
export type HashString = string;
export type ImageSource = LocalImageSource | UrlImageSource | IiifImageSource;
export type AnnotationGeometry =
  | {
      space: 'base-normalized' | 'base-pixels';
      type: 'point';
      value: PointValue;
    }
  | {
      space: 'base-normalized' | 'base-pixels';
      type: 'rect';
      value: RectValue;
    }
  | {
      space: 'base-normalized' | 'base-pixels';
      type: 'line';
      value: LineValue;
    }
  | {
      space: 'base-normalized' | 'base-pixels';
      type: 'polygon';
      value: PolygonValue;
    };

export interface ImageAlignmentProject {
  version: string;
  createdAt: string;
  updatedAt?: string;
  title?: string;
  metadata?: {
    [k: string]: JsonValue;
  };
  definitions: DefinitionRegistry;
  assetRoots: AssetRoot[];
  images: ImageRecord[];
  groups: ImageGroup[];
  alignments: ImageAlignment[];
  annotations: AnnotationRecord[];
  notes?: string;
  ui?: ProjectUIState;
}
export interface DefinitionRegistry {
  metadataSchemas: MetadataSchemaDef[];
  alignmentSchemas: AlignmentSchemaDef[];
  annotationSchemas: AnnotationSchemaDef[];
}
export interface MetadataSchemaDef {
  id: IdString;
  scope: 'project' | 'image' | 'group' | 'alignment' | 'annotation';
  title?: string;
  description?: string;
  sourceUrl?: string;
  loadedAt?: string;
  fields: MetadataFieldDef[];
}
export interface MetadataFieldDef {
  key: FieldKey;
  type: MetadataFieldType;
  label?: string;
  description?: string;
  required?: boolean;
  default?: JsonValue;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: ScalarOptionValue[];
  ui?: {
    [k: string]: JsonValue;
  };
}
export interface AlignmentSchemaDef {
  id: IdString;
  method: string;
  title?: string;
  description?: string;
  sourceUrl?: string;
  loadedAt?: string;
  paramsSchema: JsonSchemaObject;
  resultSchema?: JsonSchemaObject;
  /**
   * Default values for alignment params.
   */
  defaults?: {
    [k: string]: JsonValue;
  };
  ui?: {
    [k: string]: JsonValue;
  };
}
/**
 * Embedded schema-like object. Detailed validation is handled by the application/runtime.
 */
export interface JsonSchemaObject {
  [k: string]: unknown;
}
export interface AnnotationSchemaDef {
  id: IdString;
  title?: string;
  description?: string;
  sourceUrl?: string;
  loadedAt?: string;
  allowedGeometry?: AnnotationGeometryType[];
  dataSchema: JsonSchemaObject;
  /**
   * Default values for annotation data.
   */
  defaults?: {
    [k: string]: JsonValue;
  };
  ui?: {
    [k: string]: JsonValue;
  };
}
export interface AssetRoot {
  id: IdString;
  label: string;
  description?: string;
  expectedFolderName?: string;
}
export interface ImageRecord {
  id: IdString;
  contentHash: HashString;
  label?: string;
  /**
   * Optional external/user asset identifier for feedback into upstream systems.
   */
  assetId?: string;
  source: ImageSource;
  dimensions: Dimensions;
  metadata?: {
    [k: string]: JsonValue;
  };
}
export interface LocalImageSource {
  kind: 'local';
  rootId: IdString;
  /**
   * Project-relative or asset-root-relative reference to the local image.
   */
  imageRef: string;
}
export interface UrlImageSource {
  kind: 'url';
  url: string;
}
export interface IiifImageSource {
  kind: 'iiif';
  /**
   * Resolved IIIF image request URL.
   */
  url: string;
  infoJsonUrl?: string;
}
export interface Dimensions {
  width: number;
  height: number;
}
export interface ImageGroup {
  id: IdString;
  label?: string;
  baseImageId: IdString;
  /**
   * @minItems 1
   */
  imageIds: [IdString, ...IdString[]];
  metadata?: {
    [k: string]: JsonValue;
  };
}
export interface ImageAlignment {
  id: IdString;
  groupId: IdString;
  baseImageId: IdString;
  comparedImageId: IdString;
  /**
   * References definitions.alignmentSchemas[].id
   */
  schemaId: string;
  status: 'draft' | 'confirmed';
  confidence?: number;
  params: AlignmentParams;
  result: AlignmentResult;
  metadata?: {
    [k: string]: JsonValue;
  };
}
export interface AlignmentParams {
  [k: string]: JsonValue;
}
export interface AlignmentResult {
  /**
   * Stable discriminator for the stored result shape, e.g. matrix-3x3, mesh, tps.
   */
  transformModel: string;
  [k: string]: JsonValue;
}
export interface AnnotationRecord {
  id: IdString;
  groupId: IdString;
  /**
   * Usually the base image for the group.
   */
  anchorImageId: string;
  /**
   * One or more images involved in the comparison/annotation.
   *
   * @minItems 1
   */
  targetImageIds: [IdString, ...IdString[]];
  /**
   * References definitions.annotationSchemas[].id
   */
  schemaId: string;
  /**
   * Optional link to the alignment used when the annotation was created.
   */
  alignmentId?: string;
  geometry: AnnotationGeometry;
  /**
   * Opaque, schema-driven annotation payload.
   */
  data: {
    [k: string]: JsonValue;
  };
  metadata?: {
    [k: string]: JsonValue;
  };
}
export interface PointValue {
  x: number;
  y: number;
}
export interface RectValue {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface LineValue {
  /**
   * @minItems 2
   * @maxItems 2
   */
  points: [PointValue, PointValue];
}
export interface PolygonValue {
  /**
   * @minItems 3
   */
  points: [PointValue, PointValue, PointValue, ...PointValue[]];
}
export interface ProjectUIState {
  lastSelectedImageId?: IdString;
  lastSelectedGroupId?: IdString;
  lastSelectedAlignmentId?: IdString;
  lastSelectedAnnotationId?: IdString;
  lastMode?: 'project' | 'align' | 'annotate' | 'overview';
  sidePanelOpen?: boolean;
}
