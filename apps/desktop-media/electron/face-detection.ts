import type {
  FaceDetectionOutput,
  FaceDetectionSettings,
} from "../src/shared/ipc";
import { getDetector } from "./native-face/detector-registry";
import { DEFAULT_FACE_DETECTION_SETTINGS } from "../src/shared/ipc";

interface DetectFacesParams {
  imagePath: string;
  signal?: AbortSignal;
  settings?: FaceDetectionSettings;
}

export async function detectFacesInPhoto({
  imagePath,
  signal,
  settings,
}: DetectFacesParams): Promise<FaceDetectionOutput> {
  const detectorId =
    settings?.detectorModel ?? DEFAULT_FACE_DETECTION_SETTINGS.detectorModel;
  const detector = getDetector(detectorId);
  return detector.detect({ imagePath, signal, settings });
}
