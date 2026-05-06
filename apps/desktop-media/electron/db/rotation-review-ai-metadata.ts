import {
  rotateDimensionsQuarterTurn,
  type ImageDimensions,
  type QuarterTurnAngle,
} from "./rotation-review-geometry";
import {
  mapMetadataBoundingBoxQuarterTurn,
  type MetadataBoundingBox,
} from "./rotation-review-metadata-geometry";

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecordProperty(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  return isRecord(value) ? value : null;
}

function getOrientation(metadata: Record<string, unknown>): Record<string, unknown> {
  const orientation = metadata.orientation_detection;
  return isRecord(orientation) ? { ...orientation } : {};
}

function isQuarterTurn(value: unknown): value is QuarterTurnAngle {
  return value === 90 || value === 180 || value === 270;
}

function getFiniteDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getImageDimensions(value: unknown): ImageDimensions | null {
  if (!isRecord(value)) return null;
  const width = getFiniteDimension(value.width);
  const height = getFiniteDimension(value.height);
  return width !== null && height !== null ? { width, height } : null;
}

function remapMetadataBoxValue(
  value: unknown,
  ref: ImageDimensions,
  angleClockwise: QuarterTurnAngle,
): unknown {
  if (!isRecord(value)) return value;
  return mapMetadataBoundingBoxQuarterTurn(
    value as MetadataBoundingBox,
    ref,
    angleClockwise,
  );
}

function remapPeopleBoundingBoxes(
  value: unknown,
  ref: ImageDimensions,
  angleClockwise: QuarterTurnAngle,
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!isRecord(entry)) return entry;
    const next: Record<string, unknown> = { ...entry };
    next.person_bounding_box = remapMetadataBoxValue(next.person_bounding_box, ref, angleClockwise);
    next.person_face_bounding_box = remapMetadataBoxValue(
      next.person_face_bounding_box,
      ref,
      angleClockwise,
    );
    const providerRaw = getRecordProperty(next, "provider_raw_bounding_box");
    const providerBox = providerRaw ? remapMetadataBoxValue(providerRaw.box, ref, angleClockwise) : null;
    if (providerRaw && providerBox) {
      next.provider_raw_bounding_box = { ...providerRaw, box: providerBox };
    }
    return next;
  });
}

function updateFaceDetectionMetadataForRotation(
  metadata: Record<string, unknown>,
  sourceRef: ImageDimensions,
  angleClockwise: QuarterTurnAngle,
): void {
  const people = getRecordProperty(metadata, "people");
  const detections = people ? getRecordProperty(people, "detections") : null;
  const detectionRef =
    getImageDimensions(detections?.image_size_for_bounding_boxes) ??
    getImageDimensions(metadata.image_size_for_bounding_boxes) ??
    sourceRef;
  const rotatedRef = rotateDimensionsQuarterTurn(detectionRef, angleClockwise);

  if (detections) {
    detections.image_size_for_bounding_boxes = rotatedRef;
    detections.people_bounding_boxes = remapPeopleBoundingBoxes(
      detections.people_bounding_boxes,
      detectionRef,
      angleClockwise,
    );
  }
  if (metadata.image_size_for_bounding_boxes !== undefined) {
    metadata.image_size_for_bounding_boxes = rotatedRef;
  }
  if (metadata.people_bounding_boxes !== undefined) {
    metadata.people_bounding_boxes = remapPeopleBoundingBoxes(
      metadata.people_bounding_boxes,
      detectionRef,
      angleClockwise,
    );
  }
}

export function buildAppliedRotationMetadata(
  raw: string | null,
  angleClockwise: QuarterTurnAngle,
  sourceRef: ImageDimensions,
): string {
  const metadata = parseJsonObject(raw);
  const orientation = getOrientation(metadata);
  const processedAt = typeof orientation.processed_at === "string" ? orientation.processed_at : null;
  const detectedAngle = isQuarterTurn(orientation.correction_angle_clockwise)
    ? orientation.correction_angle_clockwise
    : angleClockwise;
  metadata.orientation_detection = {
    ...orientation,
    correction_angle_clockwise: 0,
    user_applied_rotation: {
      applied_at: new Date().toISOString(),
      angle_degrees_clockwise: angleClockwise,
      matched_processed_at: processedAt,
      matched_correction_angle_clockwise: detectedAngle,
    },
  };
  updateFaceDetectionMetadataForRotation(metadata, sourceRef, angleClockwise);
  return JSON.stringify(metadata);
}
