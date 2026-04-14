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

export function normalizeMetadata(raw: unknown): MediaMetadataV2 {
  if (!isRecord(raw)) {
    return { schema_version: '2.0' };
  }

  if (isV2Metadata(raw)) {
    return raw as MediaMetadataV2;
  }

  const legacy = raw as MediaMetadataV1;

  const normalized: MediaMetadataV2 = {
    schema_version: '2.0',
    people: {
      number_of_people: legacy.number_of_people ?? null,
      has_children: legacy.has_children ?? null,
      people_detected: legacy.people_detected ?? null,
      detections: {
        face_detection_method: legacy.face_detection_method ?? null,
        image_size_for_bounding_boxes: legacy.image_size_for_bounding_boxes ?? null,
        people_bounding_boxes: legacy.people_bounding_boxes ?? null,
      },
    },
    ai: {
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

  return normalized;
}

export function mergeMetadataV2(
  base: unknown,
  patch: Partial<MediaMetadataV2>,
): MediaMetadataV2 {
  const normalizedBase = normalizeMetadata(base);
  const mergedEmbedded =
    patch.embedded !== undefined
      ? {
          ...(isRecord(normalizedBase.embedded) ? normalizedBase.embedded : {}),
          ...(isRecord(patch.embedded) ? patch.embedded : {}),
        }
      : normalizedBase.embedded;
  return {
    ...normalizedBase,
    ...patch,
    schema_version: '2.0',
    technical: {
      ...(normalizedBase.technical ?? {}),
      ...(patch.technical ?? {}),
      capture: {
        ...(normalizedBase.technical?.capture ?? {}),
        ...(patch.technical?.capture ?? {}),
      },
    },
    ...(mergedEmbedded !== undefined ? { embedded: mergedEmbedded } : {}),
    people: {
      ...(normalizedBase.people ?? {}),
      ...(patch.people ?? {}),
      detections: {
        ...(normalizedBase.people?.detections ?? {}),
        ...(patch.people?.detections ?? {}),
      },
    },
    ai: {
      ...(normalizedBase.ai ?? {}),
      ...(patch.ai ?? {}),
    },
    provenance: {
      ...(normalizedBase.provenance ?? {}),
      ...(patch.provenance ?? {}),
      sources: {
        ...(normalizedBase.provenance?.sources ?? {}),
        ...(patch.provenance?.sources ?? {}),
      },
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
  return normalized.people?.number_of_people ?? null;
}

export function getHasChildren(metadata: unknown): boolean | null {
  const normalized = normalizeMetadata(metadata);
  return normalized.people?.has_children ?? null;
}

export function getPeopleDetected(metadata: unknown): PersonInfo[] {
  const normalized = normalizeMetadata(metadata);
  return normalized.people?.people_detected ?? [];
}

export function getAiTitle(metadata: unknown): string | null {
  return normalizeMetadata(metadata).ai?.title ?? null;
}

export function getAiDescription(metadata: unknown): string | null {
  return normalizeMetadata(metadata).ai?.description ?? null;
}

export function getAiCategory(metadata: unknown): MediaImageCategory | null {
  return normalizeMetadata(metadata).ai?.image_category ?? null;
}

export function getAiLocation(metadata: unknown): LocationData | null {
  return normalizeMetadata(metadata).ai?.location ?? null;
}

export function getAiPhotoAnalysisMethod(metadata: unknown): string | null {
  return normalizeMetadata(metadata).ai?.photo_analysis_method ?? null;
}

export function getTechnicalCapture(metadata: unknown): TechnicalCaptureMetadata | null {
  const normalized = normalizeMetadata(metadata);
  return normalized.technical?.capture ?? null;
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
  return normalizeMetadata(metadata).provenance?.metadata_version ?? null;
}

export function getMetadataExtractedAt(metadata: unknown): string | null {
  return normalizeMetadata(metadata).provenance?.metadata_extracted_at ?? null;
}

export function getAdditionalTopLevelFields(
  metadata: unknown,
): Record<string, unknown> {
  const normalized = normalizeMetadata(metadata);
  const knownKeys = new Set([
    'schema_version',
    'technical',
    'embedded',
    'people',
    'ai',
    'provenance',
    'document_data',
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
    numberOfPeople: number | null;
  },
  base?: unknown,
): MediaMetadataV2 {
  return mergeMetadataV2(base, {
    people: {
      number_of_people: input.numberOfPeople,
      detections: {
        face_detection_method: input.faceDetectionMethod,
        image_size_for_bounding_boxes: input.imageSize,
        people_bounding_boxes: input.boxes,
      },
    },
  });
}

export function metadataFromAiAnalysisUpdate(
  input: Partial<MediaMetadataV2['ai']> & {
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
    ai: {
      ...aiFields,
    },
    people: {
      number_of_people: numberOfPeople ?? undefined,
      has_children: hasChildren ?? undefined,
      people_detected: peopleDetected ?? undefined,
    },
  });
}

