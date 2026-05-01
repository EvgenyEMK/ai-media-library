import type { AppSettings } from "../src/shared/ipc";
import { checkExistingFaceLandmarksForRotation } from "./face-rotation-check";
import { ensureAuxModel } from "./native-face";
import { isOrientationClassifierReady, predictOrientation } from "./native-face/orientation-classifier";
import {
  getOrientationDetectionStateByPath,
  upsertOrientationDetectionFailure,
  upsertOrientationDetectionResult,
} from "./db/media-analysis";

function persistOrientationFailure(imagePath: string, message: string, signal?: AbortSignal): void {
  if (signal?.aborted) return;
  upsertOrientationDetectionFailure(imagePath, message);
}

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

  if (!settings.wrongImageRotationDetection.useFaceLandmarkFeaturesFallback) {
    persistOrientationFailure(imagePath, "Orientation classifier failed and face-landmark fallback is disabled.", signal);
    return "failed";
  }
  const fromLandmarks = checkExistingFaceLandmarksForRotation(imagePath);
  if (!fromLandmarks) {
    persistOrientationFailure(imagePath, "Orientation classifier and face-landmark fallback could not determine rotation.", signal);
    return "failed";
  }
  upsertOrientationDetectionResult(imagePath, {
    source: "face_landmarks",
    correctionAngleClockwise: fromLandmarks.finalAngle,
    confidence: fromLandmarks.landmarkResult?.confidence ?? null,
    model: null,
  });
  return "processed";
}
