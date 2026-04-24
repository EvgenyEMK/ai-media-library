// Media metadata types for AI-detected and structured data

/**
 * Data format version for metadata schema evolution
 */
export type MetadataDataFormatVersion = '1.0' | '2.0';

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Location data structure
 * Can be from AI detection, file EXIF data, or human input
 */
export interface LocationData {
  coordinates?: Coordinates | null;
  country?: string | null;
  country_code?: string | null; // ISO country code (e.g., 'CA', 'US')
  city?: string | null;
  place_name?: string | null; // Specific place name (e.g., 'Old Montreal', 'Eiffel Tower')
  source?: 'ai' | 'file' | 'human' | null;
}

export type StoredBoundingBoxFormat = 'normalized' | 'pixel' | 'unknown';

/**
 * Source bounding box information from the detection provider.
 * Stored for debugging/traceability only – the UI never relies on it.
 */
export interface ProviderBoundingBoxReference {
  provider_id: string;
  format: StoredBoundingBoxFormat;
  box: BoundingBox;
}

/**
 * Bounding box coordinates stored in metadata.
 * Canonical representation uses normalized Gemini format (0-1000 range)
 * relative to the image size captured in `image_width` / `image_height`.
 * Provider-specific fields (mp_x, mp_y, etc.) are optional and should only
 * be present when the provider already returned them – they are not used
 * for rendering overlays.
 */
export interface BoundingBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  image_width?: number;
  image_height?: number;
  x_min?: number;
  y_min?: number;
  x_max?: number;
  y_max?: number;
  mp_x?: number;
  mp_y?: number;
  mp_width?: number;
  mp_height?: number;
}

/**
 * Person information from image analysis (independent from bounding boxes)
 * Used to store people detected by image analysis AI (e.g., Gemini)
 */
export interface PersonInfo {
  person_category?: 'adult' | 'child' | 'baby' | null;
  gender?: 'male' | 'female' | 'unknown' | 'other' | null;
  average_age?: number | null;
}

/**
 * Being bounding box from AI detection (people and pets)
 * MediaPipe only provides face boxes, so person_bounding_box is optional
 */
export interface BeingBoundingBox {
  person_category?: 'adult' | 'child' | 'baby' | null;
  gender?: 'male' | 'female' | 'unknown' | 'other' | null;
  person_bounding_box?: BoundingBox;
  person_face_bounding_box?: BoundingBox | null;
  provider_raw_bounding_box?: ProviderBoundingBoxReference | null;
  detected_features?: FaceLandmarkFeature[] | null;
}

/**
 * Image size used for bounding box calculations
 * Gemini may resize images internally for object detection
 */
export interface ImageSizeForBoundingBoxes {
  width: number;
  height: number;
}

export type FaceDetectionMethod =
  | 'mediapipe'
  | 'azure-face'
  | 'google-vision'
  | 'retinaface'
  | 'yolov12n-face'
  | 'yolov12s-face'
  | 'yolov12m-face'
  | 'yolov12l-face'
  | 'amazon-rekognition'
  | 'unknown';

/**
 * Face landmark features that a detector may report.
 * Stored per bounding box to indicate which parts of the face were actually detected,
 * useful for identifying partial faces or diagnosing duplicate detections.
 */
export type FaceLandmarkFeature =
  | 'left_eye'
  | 'right_eye'
  | 'nose'
  | 'left_mouth_corner'
  | 'right_mouth_corner';

/**
 * Aggregate face orientation derived from landmark geometry.
 * Stored at the detections level (not per-face) as a consensus across all faces.
 */
export interface FaceOrientationMetadata {
  orientation: 'upright' | 'rotated_90_cw' | 'rotated_180' | 'rotated_270_cw';
  correction_angle_clockwise: 0 | 90 | 180 | 270;
  confidence: number;
  face_count: number;
}

export type MediaImageCategory =
  | 'document_contract'
  | 'document_other'
  | 'document_id_or_passport'
  | 'invoice_or_receipt'
  | 'screenshot'
  | 'presentation_slide'
  | 'diagram'
  | 'person_or_people'
  | 'nature'
  | 'humor'
  | 'architecture'
  | 'sports'
  | 'food'
  | 'pet'
  | 'other';

/**
 * Legacy flat metadata shape kept for backward compatibility during migration.
 */
export interface MediaMetadataV1 {
  data_format_version: MetadataDataFormatVersion;
  face_detection_method?: FaceDetectionMethod | null;
  photo_analysis_method?: string | null;
  image_category?: MediaImageCategory | null;
  title?: string | null;
  description?: string | null;
  number_of_people?: number | null;
  has_children?: boolean | null;
  people_detected?: PersonInfo[] | null;
  people_bounding_boxes?: BeingBoundingBox[] | null;
  image_size_for_bounding_boxes?: ImageSizeForBoundingBoxes | null;
  location?: LocationData | null;
  date?: string | null;
  time?: string | null;
  weather?: string | null;
  lighting?: string | null;
  photo_estetic_quality?: number | null;
  [key: string]: unknown;
}

/** Aligned with `storage/mwg-photo-metadata.ts` (same package) for capture-date precision. */
export type PhotoTakenPrecision = 'year' | 'month' | 'day' | 'instant';

export interface TechnicalCaptureMetadata {
  captured_at?: string | null;
  /** When `captured_at` is partial (XMP), records which parts are known. */
  photo_taken_precision?: PhotoTakenPrecision | null;
  /** xmp:ModifyDate (or equivalent), UTC sortable. */
  metadata_modified_at?: string | null;
  camera_make?: string | null;
  camera_model?: string | null;
  lens_model?: string | null;
  focal_length_mm?: number | null;
  f_number?: number | null;
  exposure_time?: string | null;
  iso?: number | null;
}

/** EXIF/XMP/IPTC metadata embedded in the file. */
export interface ExifXmpMetadata {
  source?: 'xmp' | 'iptc' | 'mixed' | 'file' | null;
  title?: string | null;
  description?: string | null;
  /** Freeform place string from EXIF/XMP/IPTC (not structured `LocationData`). */
  location_text?: string | null;
  star_rating?: number | null;
}

export interface DocumentData {
  invoice_issuer?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  client_number?: string | null;
  invoice_total_amount?: number | null;
  invoice_total_amount_currency?: string | null;
  vat_percent?: number | null;
  vat_amount?: number | null;
}

// ---------------------------------------------------------------------------
// Path-based metadata extraction types
// ---------------------------------------------------------------------------

export type PathExtractionSource =
  | 'script_filename'
  | 'script_folder'
  | 'script_filename+folder'
  | 'llm_path';

export interface PathDateExtraction {
  start: string | null;
  end: string | null;
  precision: 'year' | 'month' | 'day';
  source: PathExtractionSource;
  raw_match?: string;
  /** 0 = filename, 1 = parent folder, 2 = grandparent, etc. */
  from_folder_depth?: number;
}

export interface PathLocationExtraction {
  country?: string | null;
  country_code?: string | null;
  area?: string | null;
  city?: string | null;
  place_name?: string | null;
  source: PathExtractionSource;
  raw_match?: string;
}

export interface PathExtractionMetadata {
  date?: PathDateExtraction | null;
  location?: PathLocationExtraction | null;
  /** Person names found in path (FUTURE). */
  names?: string[] | null;
  /** Event descriptions found in path (FUTURE). */
  events?: string[] | null;
  display_title?: string | null;
  extracted_at?: string | null;
  llm_extracted_at?: string | null;
  llm_model?: string | null;
}

// ---------------------------------------------------------------------------
// Multi-source location (provenance tracking)
// ---------------------------------------------------------------------------

export type LocationSource =
  | 'gps'
  | 'embedded_xmp'
  | 'path_script'
  | 'path_llm'
  | 'ai_vision';

export interface SourcedLocation {
  country?: string | null;
  country_code?: string | null;
  area?: string | null;
  city?: string | null;
  place_name?: string | null;
  coordinates?: Coordinates | null;
  source: LocationSource;
}

// ---------------------------------------------------------------------------
// Event date resolution types
// ---------------------------------------------------------------------------

export type EventDateSource =
  | 'exif'
  | 'xmp'
  | 'path_script'
  | 'path_llm'
  | 'manual'
  | 'file_mtime';

export type EventDatePrecision = 'year' | 'month' | 'day' | 'instant';

export interface ResolvedEventDate {
  start: string;
  end: string | null;
  precision: EventDatePrecision;
  source: EventDateSource;
}

export interface MediaPeopleDetectionsMetadata {
  face_detection_method?: FaceDetectionMethod | null;
  image_size_for_bounding_boxes?: ImageSizeForBoundingBoxes | null;
  people_bounding_boxes?: BeingBoundingBox[] | null;
}

export interface MediaMetadataV2 {
  /**
   * Structural schema identifier for JSON shape compatibility.
   * Bump when field layout/paths change.
   */
  schema_version: '2.0';
  /**
   * Producer/version stamp for the pipeline that last wrote metadata values.
   * This tracks writer behavior and can change without changing JSON structure.
   */
  metadata_version?: string | null;
  file_data?: {
    metadata_extracted_at?: string | null;
    /**
     * Container for file-derived technical groups.
     * Kept as a namespace so future technical groups (e.g. video/audio blocks)
     * can be added without crowding `file_data` top-level keys.
     */
    technical?: {
      capture?: TechnicalCaptureMetadata;
      [key: string]: unknown;
    };
    exif_xmp?: ExifXmpMetadata | null;
  };
  people?: {
    face_count?: number | null;
    vlm_analysis?: {
      number_of_people?: number | null;
      has_children?: boolean | null;
      people_detected?: PersonInfo[] | null;
    } | null;
    detections?: MediaPeopleDetectionsMetadata;
  };
  image_analysis?: {
    photo_analysis_method?: string | null;
    image_category?: MediaImageCategory | null;
    title?: string | null;
    description?: string | null;
    location?: LocationData | null;
    date?: string | null;
    time?: string | null;
    weather?: string | null;
    lighting?: string | null;
    photo_estetic_quality?: number | null;
    is_low_quality?: boolean | null;
    quality_issues?: string[] | null;
    edit_suggestions?: unknown[] | null;
    [key: string]: unknown;
  };
  document_data?: DocumentData | null;
  path_extraction?: PathExtractionMetadata | null;
  locations_by_source?: SourcedLocation[] | null;
  [key: string]: unknown;
}

export type AnyMediaMetadata = MediaMetadataV1 | MediaMetadataV2;

/**
 * Main metadata type for new writes.
 */
export type MediaMetadata = MediaMetadataV2;

export function isV2Metadata(value: unknown): value is MediaMetadataV2 {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const schemaVersion = (value as { schema_version?: unknown }).schema_version;
  return schemaVersion === '2.0';
}
