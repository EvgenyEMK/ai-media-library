import type {
  FaceDetectionOutput,
  FaceDetectionSettings,
} from "../src/shared/ipc";
import { detectFacesNative } from "./native-face/retinaface-detector";

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
  return detectFacesNative({ imagePath, signal, settings });
}
