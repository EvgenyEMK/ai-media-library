import type {
  AnyMediaMetadata,
  BeingBoundingBox,
  FaceDetectionMethod,
  ImageSizeForBoundingBoxes,
  LocationData,
  MediaImageCategory,
  MediaMetadataV1,
  MediaMetadataV2,
  PersonInfo,
  PhotoTakenPrecision,
  TechnicalCaptureMetadata,
} from "./media-metadata";
import { isV2Metadata } from "./media-metadata";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function asNullableBoolean(value: unknown): boolean | null | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function normalizeQualityIssuesNode(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.toLowerCase() !== 'none');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([k, v]) => /^\d+$/.test(k) && typeof v === 'string')
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, v]) => (v as string).trim())
      .filter((entry) => entry.length > 0 && entry.toLowerCase() !== 'none');
  }
  return null;
}

function sanitizeImageAnalysisInPlace(metadata: MediaMetadataV2): void {
  const rawRec = metadata as Record<string, unknown>;
  const sourceNode = isRecord(metadata.image_analysis) ? metadata.image_analysis : {};
  const nextNode = { ...(sourceNode as Record<string, unknown>) };
  if (nextNode.photo_estetic_quality === undefined && asNullableNumber(rawRec.photo_estetic_quality) !== undefined) {
    nextNode.photo_estetic_quality = asNullableNumber(rawRec.photo_estetic_quality) ?? null;
  }
  if (nextNode.is_low_quality === undefined && asNullableBoolean(rawRec.is_low_quality) !== undefined) {
    nextNode.is_low_quality = asNullableBoolean(rawRec.is_low_quality) ?? null;
  }
  if (nextNode.edit_suggestions === undefined && rawRec.edit_suggestions !== undefined) {
    nextNode.edit_suggestions = rawRec.edit_suggestions;
  }
  if (nextNode.quality_issues === undefined && rawRec.quality_issues !== undefined) {
    nextNode.quality_issues = rawRec.quality_issues;
  }
  delete nextNode.star_rating_1_5;
  nextNode.quality_issues = normalizeQualityIssuesNode(nextNode.quality_issues);
  metadata.image_analysis = nextNode as MediaMetadataV2["image_analysis"];
  delete rawRec.photo_star_rating_1_5;
  delete rawRec.star_rating_1_5;
  delete rawRec.photo_estetic_quality;
  delete rawRec.is_low_quality;
  delete rawRec.quality_issues;
  delete rawRec.edit_suggestions;
}

function readVlmAnalysisPeopleNode(
  metadata: MediaMetadataV2,
): { number_of_people: number | null; has_children: boolean | null; people_detected: PersonInfo[] | null } | null {
  const node = metadata.people?.vlm_analysis;
  if (!isRecord(node)) {
    return null;
  }
  return {
    number_of_people: asNullableNumber(node.number_of_people) ?? null,
    has_children: asNullableBoolean(node.has_children) ?? null,
    people_detected: Array.isArray(node.people_detected) ? (node.people_detected as PersonInfo[]) : null,
  };
}

export function normalizeMetadata(raw: unknown): MediaMetadataV2 {
  if (!isRecord(raw)) {
    return { schema_version: '2.0' };
  }

  if (isV2Metadata(raw)) {
    const v2 = { ...(raw as MediaMetadataV2) };
    if (isRecord(v2.image_analysis)) {
      v2.image_analysis = { ...(v2.image_analysis as Record<string, unknown>) };
    }
    if (!v2.file_data) {
      v2.file_data = {};
    }
    if (
      (v2.file_data.metadata_extracted_at === undefined || v2.file_data.metadata_extracted_at === null) &&
      isRecord((v2 as { provenance?: unknown }).provenance)
    ) {
      v2.file_data.metadata_extracted_at = asNullableString(
        ((v2 as { provenance?: Record<string, unknown> }).provenance ?? {}).metadata_extracted_at,
      ) ?? null;
    }
    if (
      (v2.metadata_version === undefined || v2.metadata_version === null) &&
      isRecord((v2 as { provenance?: unknown }).provenance)
    ) {
      v2.metadata_version = asNullableString(
        ((v2 as { provenance?: Record<string, unknown> }).provenance ?? {}).metadata_version,
      ) ?? null;
    }
    delete (v2 as Record<string, unknown>).provenance;
    sanitizeImageAnalysisInPlace(v2);
    return v2;
  }

  const legacy = raw as MediaMetadataV1;

  const normalized: MediaMetadataV2 = {
    schema_version: '2.0',
    metadata_version: null,
    file_data: {
      metadata_extracted_at: null,
      technical: {
        capture: {
          captured_at: null,
          photo_taken_precision: null,
          metadata_modified_at: null,
          camera_make: null,
          camera_model: null,
          lens_model: null,
          focal_length_mm: null,
          f_number: null,
          exposure_time: null,
          iso: null,
        },
      },
      exif_xmp: null,
    },
    people: {
      face_count: legacy.number_of_people ?? null,
      vlm_analysis: {
        number_of_people: legacy.number_of_people ?? null,
        has_children: legacy.has_children ?? null,
        people_detected: legacy.people_detected ?? null,
      },
      detections: {
        face_detection_method: legacy.face_detection_method ?? null,
        image_size_for_bounding_boxes: legacy.image_size_for_bounding_boxes ?? null,
        people_bounding_boxes: legacy.people_bounding_boxes ?? null,
      },
    },
    image_analysis: {
      photo_analysis_method: legacy.photo_analysis_method ?? null,
      image_category: (legacy.image_category as MediaImageCategory | null | undefined) ?? null,
      title: legacy.title ?? null,
      description: legacy.description ?? null,
      location: legacy.location ?? null,
      date: legacy.date ?? null,
      time: legacy.time ?? null,
      weather: legacy.weather ?? null,
      lighting: legacy.lighting ?? null,
      photo_estetic_quality: legacy.photo_estetic_quality ?? null,
    },
  };

  // Preserve unknown keys from v1 payload for forward compatibility.
  const knownLegacyKeys = new Set([
    'data_format_version',
    'face_detection_method',
    'photo_analysis_method',
    'image_category',
    'title',
    'description',
    'number_of_people',
    'has_children',
    'people_detected',
    'people_bounding_boxes',
    'image_size_for_bounding_boxes',
    'location',
    'date',
    'time',
    'weather',
    'lighting',
    'photo_estetic_quality',
  ]);

  for (const [key, value] of Object.entries(legacy)) {
    if (!knownLegacyKeys.has(key)) {
      normalized[key] = value;
    }
  }

  sanitizeImageAnalysisInPlace(normalized);

  return normalized;
}

export function mergeMetadataV2(
  base: unknown,
  patch: Partial<MediaMetadataV2>,
): MediaMetadataV2 {
  const normalizedBase = normalizeMetadata(base);
  const mergedExifXmp =
    patch.file_data?.exif_xmp !== undefined
      ? {
          ...(isRecord(normalizedBase.file_data?.exif_xmp) ? normalizedBase.file_data?.exif_xmp : {}),
          ...(isRecord(patch.file_data?.exif_xmp) ? patch.file_data?.exif_xmp : {}),
        }
      : normalizedBase.file_data?.exif_xmp;
  return {
    ...normalizedBase,
    ...patch,
    schema_version: '2.0',
    file_data: {
      ...(normalizedBase.file_data ?? {}),
      ...(patch.file_data ?? {}),
      technical: {
        ...(normalizedBase.file_data?.technical ?? {}),
        ...(patch.file_data?.technical ?? {}),
        capture: {
          ...(normalizedBase.file_data?.technical?.capture ?? {}),
          ...(patch.file_data?.technical?.capture ?? {}),
        },
      },
      ...(mergedExifXmp !== undefined ? { exif_xmp: mergedExifXmp } : {}),
    },
    people: {
      ...(normalizedBase.people ?? {}),
      ...(patch.people ?? {}),
      ...(patch.people?.vlm_analysis !== undefined
        ? {
            vlm_analysis: {
              ...(normalizedBase.people?.vlm_analysis ?? {}),
              ...(patch.people?.vlm_analysis ?? {}),
            },
          }
        : {}),
      detections: {
        ...(normalizedBase.people?.detections ?? {}),
        ...(patch.people?.detections ?? {}),
      },
    },
    image_analysis: {
      ...(normalizedBase.image_analysis ?? {}),
      ...(patch.image_analysis ?? {}),
    },
  };
}

export function getPeopleBoundingBoxes(metadata: unknown): BeingBoundingBox[] {
  const normalized = normalizeMetadata(metadata);
  return normalized.people?.detections?.people_bounding_boxes ?? [];
}

export function getFaceDetectionMethod(metadata: unknown): FaceDetectionMethod | null {
  const normalized = normalizeMetadata(metadata);
  return normalized.people?.detections?.face_detection_method ?? null;
}

export function getImageSizeForBoundingBoxes(
  metadata: unknown,
): ImageSizeForBoundingBoxes | null {
  const normalized = normalizeMetadata(metadata);
  return normalized.people?.detections?.image_size_for_bounding_boxes ?? null;
}

export function getNumberOfPeople(metadata: unknown): number | null {
  const normalized = normalizeMetadata(metadata);
  const vlm = readVlmAnalysisPeopleNode(normalized);
  return vlm?.number_of_people ?? null;
}

export function getHasChildren(metadata: unknown): boolean | null {
  const normalized = normalizeMetadata(metadata);
  const vlm = readVlmAnalysisPeopleNode(normalized);
  return vlm?.has_children ?? null;
}

export function getPeopleDetected(metadata: unknown): PersonInfo[] {
  const normalized = normalizeMetadata(metadata);
  const vlm = readVlmAnalysisPeopleNode(normalized);
  return Array.isArray(vlm?.people_detected) ? vlm.people_detected : [];
}

export function getAiTitle(metadata: unknown): string | null {
  return normalizeMetadata(metadata).image_analysis?.title ?? null;
}

export function getAiDescription(metadata: unknown): string | null {
  return normalizeMetadata(metadata).image_analysis?.description ?? null;
}

export function getAiCategory(metadata: unknown): MediaImageCategory | null {
  return normalizeMetadata(metadata).image_analysis?.image_category ?? null;
}

export function getAiLocation(metadata: unknown): LocationData | null {
  return normalizeMetadata(metadata).image_analysis?.location ?? null;
}

export function getAiPhotoAnalysisMethod(metadata: unknown): string | null {
  return normalizeMetadata(metadata).image_analysis?.photo_analysis_method ?? null;
}

export function getTechnicalCapture(metadata: unknown): TechnicalCaptureMetadata | null {
  const normalized = normalizeMetadata(metadata);
  return normalized.file_data?.technical?.capture ?? null;
}

export function extractTechnicalCaptureFromUnknown(
  metadata: unknown,
): TechnicalCaptureMetadata | null {
  const capture = getTechnicalCapture(metadata);
  if (!capture || !isRecord(capture)) {
    return null;
  }
  return {
    captured_at: asNullableString(capture.captured_at) ?? null,
    photo_taken_precision: (capture.photo_taken_precision as PhotoTakenPrecision | undefined) ?? null,
    metadata_modified_at: asNullableString(capture.metadata_modified_at) ?? null,
    camera_make: asNullableString(capture.camera_make) ?? null,
    camera_model: asNullableString(capture.camera_model) ?? null,
    lens_model: asNullableString(capture.lens_model) ?? null,
    focal_length_mm: asNullableNumber(capture.focal_length_mm) ?? null,
    f_number: asNullableNumber(capture.f_number) ?? null,
    exposure_time: asNullableString(capture.exposure_time) ?? null,
    iso: asNullableNumber(capture.iso) ?? null,
  };
}

export function getMetadataVersion(metadata: unknown): string | null {
  return normalizeMetadata(metadata).metadata_version ?? null;
}

export function getMetadataExtractedAt(metadata: unknown): string | null {
  return normalizeMetadata(metadata).file_data?.metadata_extracted_at ?? null;
}

export function getAdditionalTopLevelFields(
  metadata: unknown,
): Record<string, unknown> {
  const normalized = normalizeMetadata(metadata);
  const knownKeys = new Set([
    'schema_version',
    'metadata_version',
    'file_data',
    'people',
    'image_analysis',
    'document_data',
    'path_extraction',
    'locations_by_source',
  ]);
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (!knownKeys.has(key)) {
      extras[key] = value;
    }
  }
  return extras;
}

export function getSchemaVersion(metadata: unknown): '2.0' {
  return normalizeMetadata(metadata).schema_version;
}

export function hasPeopleBoundingBoxes(metadata: unknown): boolean {
  return getPeopleBoundingBoxes(metadata).length > 0;
}

export function metadataFromFaceDetectionUpdate(
  input: {
    faceDetectionMethod: FaceDetectionMethod | null;
    imageSize: ImageSizeForBoundingBoxes | null;
    boxes: BeingBoundingBox[] | null;
    faceCount: number | null;
  },
  base?: unknown,
): MediaMetadataV2 {
  return mergeMetadataV2(base, {
    people: {
      face_count: input.faceCount,
      detections: {
        face_detection_method: input.faceDetectionMethod,
        image_size_for_bounding_boxes: input.imageSize,
        people_bounding_boxes: input.boxes,
      },
    },
  });
}

export function metadataFromAiAnalysisUpdate(
  input: Partial<MediaMetadataV2['image_analysis']> & {
    numberOfPeople?: number | null;
    hasChildren?: boolean | null;
    peopleDetected?: PersonInfo[] | null;
  },
  base?: unknown,
): MediaMetadataV2 {
  const {
    numberOfPeople,
    hasChildren,
    peopleDetected,
    ...aiFields
  } = input;
  return mergeMetadataV2(base, {
    image_analysis: {
      ...aiFields,
    },
    people: {
      vlm_analysis: {
        number_of_people: numberOfPeople ?? null,
        has_children: hasChildren ?? null,
        people_detected: peopleDetected ?? null,
      },
    },
  });
}

