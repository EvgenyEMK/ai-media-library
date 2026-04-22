/**
 * Desktop-specific face-landmark rotation verification.
 *
 * Uses the shared heuristics from @emk/shared-contracts combined with
 * the local RetinaFace detection service and SQLite face instances.
 */

import {
  buildProviderRawBoundingBoxReference,
  estimateRotationFromFaceLandmarks,
  fromXyxyPixelBox,
  validateRotationWithFaceLandmarks,
  type FaceBoundingBoxLike,
  type FaceLandmarkRotationResult,
  type QuarterTurnAngle,
} from "@emk/shared-contracts";
import { detectFacesInPhoto } from "./face-detection";
import { createRotatedTempImage } from "./photo-analysis";
import type { FaceDetectionOutput, FaceDetectionSettings } from "../src/shared/ipc";

interface MinimalSQLiteDatabase {
  prepare(sql: string): { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown };
}

type DatabaseProvider = () => MinimalSQLiteDatabase;

let _databaseProvider: DatabaseProvider | null = null;

/**
 * Register a function that returns the SQLite database instance.
 * In the Electron main process this is set automatically; for tests it can be
 * set to the test-specific DB instance.
 */
export function setDatabaseProvider(provider: DatabaseProvider): void {
  _databaseProvider = provider;
}

function getDesktopDatabaseLazy(): MinimalSQLiteDatabase | null {
  if (!_databaseProvider) {
    return null;
  }
  try {
    return _databaseProvider();
  } catch {
    return null;
  }
}

const DEFAULT_LIBRARY_ID = "default";
const HIGH_CONFIDENCE_THRESHOLD = 0.4;
const MIN_FACES_FOR_STRONG_SIGNAL = 1;
const PROVIDER_RAW_BBOX_DEBUG =
  process.env.EMK_DESKTOP_FACE_INCLUDE_PROVIDER_RAW_BOX === "1";

interface ExistingFaceLandmarks {
  landmarks: [number, number][];
  score: number;
}

export interface RotationDetectedFaces {
  faces: FaceDetectionOutput;
  rotationAngleUsed: QuarterTurnAngle;
  originalImageWidth: number;
  originalImageHeight: number;
}

export interface FaceRotationCheckResult {
  finalAngle: QuarterTurnAngle | 0;
  source: "face-existing" | "face-rotated-check" | "face-flipped-check" | "vlm-fallback";
  landmarkResult: FaceLandmarkRotationResult | null;
  detectedFaces: RotationDetectedFaces | null;
}

/**
 * Tier 1: Check existing face instances (from a previous face-detection run)
 * for a strong orientation signal.
 *
 * Returns `null` when no strong signal is available (caller should fall
 * through to VLM analysis).
 */
export function checkExistingFaceLandmarksForRotation(
  imagePath: string,
  libraryId: string = DEFAULT_LIBRARY_ID,
): FaceRotationCheckResult | null {
  const fileName = imagePath.split(/[\\/]/).pop() ?? imagePath;
  const faces = queryFaceLandmarksForPath(imagePath, libraryId);
  if (faces.length === 0) {
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.log(`[face-rotation-check] Tier1 "${fileName}": 0 faces in DB for path`);
    return null;
  }

  const result = estimateRotationFromFaceLandmarks(faces);
  if (!result) {
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.log(
    //   `[face-rotation-check] Tier1 "${fileName}": ${faces.length} faces in DB, but heuristic returned null` +
    //   ` (landmarks may be ambiguous)`,
    // );
    return null;
  }

  const isStrongSignal =
    result.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
    result.faceCount >= MIN_FACES_FOR_STRONG_SIGNAL &&
    (result.unanimousAgreement || result.faceCount === 1);

  if (!isStrongSignal) {
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.log(
    //   `[face-rotation-check] Tier1 "${fileName}": weak signal -` +
    //   ` orientation=${result.orientation} correction=${result.correctionAngleClockwise}` +
    //   ` confidence=${result.confidence.toFixed(3)} faceCount=${result.faceCount}` +
    //   ` unanimous=${result.unanimousAgreement}`,
    // );
    return null;
  }

  // Do not delete – may be needed for future debugging of face-rotation pipeline
  // console.log(
  //   `[face-rotation-check] Tier1 "${fileName}": strong signal -` +
  //   ` orientation=${result.orientation} correction=${result.correctionAngleClockwise}` +
  //   ` confidence=${result.confidence.toFixed(3)} faceCount=${result.faceCount}`,
  // );

  return {
    finalAngle: result.correctionAngleClockwise,
    source: "face-existing",
    landmarkResult: result,
    detectedFaces: null,
  };
}

/**
 * Tier 2: After the VLM suggests a rotation, verify/correct it using
 * face detection on the rotated (and optionally flipped) image.
 *
 * Flow:
 * 1. Run face detection on the image rotated by `vlmAngle`.
 * 2. If faces found: check landmarks. If upright -> accept VLM. If upside-down -> flip 180.
 * 3. If no faces found: try the upside-down version (vlmAngle + 180).
 * 4. If still no faces: return null (caller falls back to VLM two-pass).
 */
export async function verifyVlmRotationWithFaceDetection(
  imagePath: string,
  vlmAngle: QuarterTurnAngle,
  faceDetectionSettings?: FaceDetectionSettings,
  signal?: AbortSignal,
): Promise<FaceRotationCheckResult | null> {
  const fileName = imagePath.split(/[\\/]/).pop() ?? imagePath;

  const rotatedCheck = await detectFacesOnRotatedImage(
    imagePath,
    vlmAngle,
    faceDetectionSettings,
    signal,
  );

  if (rotatedCheck?.rotation) {
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.log(
    //   `[face-rotation-check] Tier2 "${fileName}": face found on rotated(${vlmAngle})` +
    //   ` orientation=${rotatedCheck.rotation.orientation} faceCount=${rotatedCheck.rotation.faceCount}`,
    // );
    const validation = validateRotationWithFaceLandmarks(vlmAngle, rotatedCheck.rotation);
    return {
      finalAngle: validation.finalAngle,
      source: validation.source === "vlm" ? "face-rotated-check" : "face-flipped-check",
      landmarkResult: rotatedCheck.rotation,
      detectedFaces: rotatedCheck.rawFaces
        ? { faces: rotatedCheck.rawFaces, rotationAngleUsed: vlmAngle, ...rotatedCheck.originalDimensions }
        : null,
    };
  }

  // Do not delete – may be needed for future debugging of face-rotation pipeline
  // console.log(
  //   `[face-rotation-check] Tier2 "${fileName}": no face on rotated(${vlmAngle}), trying flipped`,
  // );

  const flippedAngleRaw = (vlmAngle + 180) % 360;
  if (flippedAngleRaw !== 90 && flippedAngleRaw !== 180 && flippedAngleRaw !== 270) {
    return null;
  }
  const flippedAngle: QuarterTurnAngle = flippedAngleRaw;

  const flippedCheck = await detectFacesOnRotatedImage(
    imagePath,
    flippedAngle,
    faceDetectionSettings,
    signal,
  );

  // Do not delete – may be needed for future debugging of face-rotation pipeline
  // if (flippedCheck?.rotation) {
  //   console.log(
  //     `[face-rotation-check] Tier2 "${fileName}": face found on flipped(${flippedAngle})` +
  //     ` orientation=${flippedCheck.rotation.orientation} faceCount=${flippedCheck.rotation.faceCount}`,
  //   );
  // } else {
  //   console.log(
  //     `[face-rotation-check] Tier2 "${fileName}": no face on flipped(${flippedAngle}) either`,
  //   );
  // }

  if (flippedCheck?.rotation && flippedCheck.rotation.orientation === "upright") {
    return {
      finalAngle: flippedAngle as QuarterTurnAngle,
      source: "face-flipped-check",
      landmarkResult: flippedCheck.rotation,
      detectedFaces: flippedCheck.rawFaces
        ? { faces: flippedCheck.rawFaces, rotationAngleUsed: flippedAngle, ...flippedCheck.originalDimensions }
        : null,
    };
  }

  return null;
}

interface RotatedImageDetectionResult {
  rotation: FaceLandmarkRotationResult | null;
  rawFaces: FaceDetectionOutput | null;
  originalDimensions: { originalImageWidth: number; originalImageHeight: number };
}

async function detectFacesOnRotatedImage(
  imagePath: string,
  angle: QuarterTurnAngle,
  settings?: FaceDetectionSettings,
  signal?: AbortSignal,
): Promise<RotatedImageDetectionResult | null> {
  const fileName = imagePath.split(/[\\/]/).pop() ?? imagePath;
  let rotated: { path: string; cleanup: () => Promise<void> } | null = null;
  try {
    rotated = await createRotatedTempImage(imagePath, angle);
    const detection = await detectFacesInPhoto({
      imagePath: rotated.path,
      settings,
      signal,
    });

    const rotatedSize = detection.imageSizeForBoundingBoxes;
    const originalDimensions = deriveOriginalDimensions(rotatedSize, angle);

    if (detection.faceCount === 0) {
      return null;
    }

    const faces = detection.faces.map((face) => ({
      landmarks: face.landmarks_5,
      score: face.score,
    }));

    return {
      rotation: estimateRotationFromFaceLandmarks(faces),
      rawFaces: detection,
      originalDimensions,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.warn(`[face-rotation-check] detectFacesOnRotatedImage "${fileName}" @${angle}° failed: ${msg}`);
    return null;
  } finally {
    if (rotated) {
      await rotated.cleanup();
    }
  }
}

function deriveOriginalDimensions(
  rotatedSize: { width: number; height: number } | null,
  angle: QuarterTurnAngle,
): { originalImageWidth: number; originalImageHeight: number } {
  if (!rotatedSize) {
    return { originalImageWidth: 0, originalImageHeight: 0 };
  }
  if (angle === 90 || angle === 270) {
    return { originalImageWidth: rotatedSize.height, originalImageHeight: rotatedSize.width };
  }
  return { originalImageWidth: rotatedSize.width, originalImageHeight: rotatedSize.height };
}

function queryFaceLandmarksForPath(
  imagePath: string,
  libraryId: string,
): ExistingFaceLandmarks[] {
  const db = getDesktopDatabaseLazy();
  if (!db) {
    const fileName = imagePath.split(/[\\/]/).pop() ?? imagePath;
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.log(`[face-rotation-check] queryFaceLandmarks "${fileName}": DB provider not set`);
    return [];
  }
  const rows = db
    .prepare(
      `SELECT fi.confidence, fi.landmarks_json
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE mi.library_id = ?
         AND mi.source_path = ?
         AND fi.landmarks_json IS NOT NULL
       ORDER BY fi.confidence DESC`,
    )
    .all(libraryId, imagePath) as Array<{
    confidence: number | null;
    landmarks_json: string;
  }>;

  const results: ExistingFaceLandmarks[] = [];
  for (const row of rows) {
    const landmarks = parseLandmarksJson(row.landmarks_json);
    if (landmarks && landmarks.length >= 5) {
      results.push({
        landmarks,
        score: row.confidence ?? 0,
      });
    }
  }
  return results;
}

/**
 * Transform face coordinates detected on a rotated image back to the
 * original (unrotated) image's pixel space.
 *
 * Returns a new FaceDetectionOutput with transformed bbox, landmarks,
 * and corrected imageSizeForBoundingBoxes.
 */
export function transformFacesToOriginalCoordinates(
  rotatedFaces: RotationDetectedFaces,
): FaceDetectionOutput {
  const { faces: detection, rotationAngleUsed: angle, originalImageWidth, originalImageHeight } = rotatedFaces;
  const rotatedSize = detection.imageSizeForBoundingBoxes;

  if (!rotatedSize || originalImageWidth <= 0 || originalImageHeight <= 0) {
    return detection;
  }

  const transformedFaces = detection.faces.map((face) => {
    const [x1, y1, x2, y2] = face.bbox_xyxy;
    const c1 = transformPixelPoint(x1, y1, angle, rotatedSize);
    const c2 = transformPixelPoint(x2, y2, angle, rotatedSize);
    const newX1 = Math.min(c1.x, c2.x);
    const newY1 = Math.min(c1.y, c2.y);
    const newX2 = Math.max(c1.x, c2.x);
    const newY2 = Math.max(c1.y, c2.y);

    const transformedLandmarks = face.landmarks_5.map(
      ([lx, ly]) => {
        const t = transformPixelPoint(lx, ly, angle, rotatedSize);
        return [t.x, t.y] as [number, number];
      },
    );

    return {
      bbox_xyxy: [newX1, newY1, newX2, newY2] as [number, number, number, number],
      score: face.score,
      landmarks_5: transformedLandmarks,
    };
  });

  const originalSize = { width: originalImageWidth, height: originalImageHeight };

  const transformedPeopleBoundingBoxes = transformedFaces.map((face, idx) => ({
    person_category: null,
    gender: null,
    person_bounding_box: null,
    person_face_bounding_box: fromXyxyPixelBox(face.bbox_xyxy, originalSize),
    provider_raw_bounding_box: PROVIDER_RAW_BBOX_DEBUG
      ? buildProviderRawBoundingBoxReference(
          detection.modelInfo?.service ?? "face-detector",
          toRawPixelBoundingBox(face.bbox_xyxy, originalSize),
        )
      : null,
    azureFaceAttributes: null,
    detected_features: detection.peopleBoundingBoxes[idx]?.detected_features ?? null,
  }));

  return {
    ...detection,
    faces: transformedFaces,
    peopleBoundingBoxes: transformedPeopleBoundingBoxes,
    imageSizeForBoundingBoxes: originalSize,
  };
}

/**
 * Map a pixel coordinate from the rotated image back to the original.
 *
 * For CW rotation by θ:
 *   90°:  (x_r, y_r) → (y_r, W_rotated - 1 - x_r)
 *  180°:  (x_r, y_r) → (W_rotated - 1 - x_r, H_rotated - 1 - y_r)
 *  270°:  (x_r, y_r) → (H_rotated - 1 - y_r, x_r)
 */
function transformPixelPoint(
  x: number,
  y: number,
  angleCw: QuarterTurnAngle,
  rotatedSize: { width: number; height: number },
): { x: number; y: number } {
  const { width: W, height: H } = rotatedSize;
  switch (angleCw) {
    case 90:
      return { x: y, y: W - 1 - x };
    case 180:
      return { x: W - 1 - x, y: H - 1 - y };
    case 270:
      return { x: H - 1 - y, y: x };
  }
}

function toRawPixelBoundingBox(
  bbox: [number, number, number, number],
  imageSize: { width: number; height: number } | null,
): FaceBoundingBoxLike {
  const [x1, y1, x2, y2] = bbox;
  return {
    mp_x: x1,
    mp_y: y1,
    mp_width: Math.max(0, x2 - x1),
    mp_height: Math.max(0, y2 - y1),
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
    image_width: imageSize?.width,
    image_height: imageSize?.height,
  };
}

function parseLandmarksJson(json: string | null): [number, number][] | null {
  if (!json) {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const points: [number, number][] = [];
    for (const point of parsed) {
      if (
        Array.isArray(point) &&
        point.length >= 2 &&
        typeof point[0] === "number" &&
        typeof point[1] === "number" &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1])
      ) {
        points.push([point[0], point[1]]);
      }
    }
    return points.length >= 5 ? points : null;
  } catch {
    return null;
  }
}
