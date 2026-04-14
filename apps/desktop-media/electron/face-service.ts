import type { FaceDetectionServiceStatus } from "../src/shared/ipc";
import { isNativeBackendReady } from "./native-face/backend-switch";
import { ensureModelsDownloaded } from "./native-face/model-manager";

export async function ensureFaceDetectionServiceRunning(): Promise<boolean> {
  if (isNativeBackendReady()) return true;
  try {
    await ensureModelsDownloaded();
    return isNativeBackendReady();
  } catch {
    return false;
  }
}

export async function getFaceDetectionServiceStatus(): Promise<FaceDetectionServiceStatus> {
  const ready = isNativeBackendReady();
  return {
    healthy: ready,
    running: ready,
    autoStarted: false,
    endpoint: "native-onnx",
    modelName: ready ? "retinaface_mv2 + w600k_r50 (native ONNX)" : null,
    modelPath: null,
    error: ready ? null : "Native face models not downloaded or failed to load",
  };
}
