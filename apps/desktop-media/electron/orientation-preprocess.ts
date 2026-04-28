import type { AppSettings } from "../src/shared/ipc";
import { checkExistingFaceLandmarksForRotation } from "./face-rotation-check";
import { ensureAuxModel } from "./native-face";
import { isOrientationClassifierReady, predictOrientation } from "./native-face/orientation-classifier";
import {
  getOrientationDetectionStateByPath,
  upsertOrientationDetectionResult,
} from "./db/media-analysis";

export async function runWrongImageRotationPrecheck(params: {
  imagePath: string;
  settings: AppSettings;
  signal?: AbortSignal;
  force?: boolean;
}): Promise<"processed" | "skipped" | "failed" | "disabled"> {
  const { imagePath, settings, signal, force = false } = params;
  if (!settings.wrongImageRotationDetection.enabled) return "disabled";

  const already = getOrientationDetectionStateByPath(imagePath);
  if (already && !force) return "skipped";

  const model = settings.faceDetection.imageOrientationDetection.model;

  try {
    await ensureAuxModel("orientation", model);
  } catch {
    // Keep fallback behavior below.
  }

  if (isOrientationClassifierReady(model)) {
    try {
      const prediction = await predictOrientation({
        imagePath,
        model,
        signal,
      });
      upsertOrientationDetectionResult(imagePath, {
        source: "image-orientation-classifier",
        correctionAngleClockwise: prediction.correctionClockwise,
        confidence: prediction.confidence,
        model: prediction.model,
      });
      return "processed";
    } catch {
      // Continue to fallback.
    }
  }

  if (!settings.wrongImageRotationDetection.useFaceLandmarkFeaturesFallback) return "failed";
  const fromLandmarks = checkExistingFaceLandmarksForRotation(imagePath);
  if (!fromLandmarks) return "failed";
  upsertOrientationDetectionResult(imagePath, {
    source: "face_landmarks",
    correctionAngleClockwise: fromLandmarks.finalAngle,
    confidence: fromLandmarks.landmarkResult?.confidence ?? null,
    model: null,
  });
  return "processed";
}
