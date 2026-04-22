import type {
  FaceDetectionOutput,
  FaceDetectionSettings,
} from "../src/shared/ipc";
import { getDetector } from "./native-face/detector-registry";
import { DEFAULT_FACE_DETECTION_SETTINGS } from "../src/shared/ipc";
import {
  type OrientationPrediction,
} from "./native-face/orientation-classifier";

interface DetectFacesParams {
  imagePath: string;
  signal?: AbortSignal;
  settings?: FaceDetectionSettings;
}

export interface DetectFacesResult {
  faces: FaceDetectionOutput;
  imageOrientation: OrientationPrediction | null;
}

export async function detectFacesInPhoto({
  imagePath,
  signal,
  settings,
}: DetectFacesParams): Promise<FaceDetectionOutput> {
  const result = await detectFacesInPhotoWithOrientation({
    imagePath,
    signal,
    settings,
  });
  return result.faces;
}

/**
 * Full detection that also optionally runs the image orientation classifier as
 * a pre-step. Returns both the face detection output and the classifier
 * prediction (when enabled and ready) so callers can persist both signals
 * independently.
 */
export async function detectFacesInPhotoWithOrientation({
  imagePath,
  signal,
  settings,
}: DetectFacesParams): Promise<DetectFacesResult> {
  const detectorId =
    settings?.detectorModel ?? DEFAULT_FACE_DETECTION_SETTINGS.detectorModel;
  const detector = getDetector(detectorId);
  const faces = await detector.detect({ imagePath, signal, settings });
  return { faces, imageOrientation: null };
}
