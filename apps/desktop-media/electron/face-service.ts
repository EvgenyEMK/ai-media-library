import { app } from "electron";
import type {
  FaceDetectionServiceStatus,
  FaceDetectorModelId,
} from "../src/shared/ipc";
import {
  DEFAULT_FACE_DETECTION_SETTINGS,
} from "../src/shared/ipc";
import { isDetectorBackendReady } from "./native-face/backend-switch";
import {
  ensureActiveModels,
  getDetectorModelFilename,
} from "./native-face/model-manager";
import { readSettings } from "./storage";

async function resolveActiveDetectorId(): Promise<FaceDetectorModelId> {
  try {
    const settings = await readSettings(app.getPath("userData"));
    return settings.faceDetection.detectorModel;
  } catch {
    return DEFAULT_FACE_DETECTION_SETTINGS.detectorModel;
  }
}

export async function ensureFaceDetectionServiceRunning(): Promise<boolean> {
  const detectorId = await resolveActiveDetectorId();
  if (isDetectorBackendReady(detectorId)) return true;
  try {
    await ensureActiveModels(detectorId);
    return isDetectorBackendReady(detectorId);
  } catch {
    return false;
  }
}

export async function getFaceDetectionServiceStatus(): Promise<FaceDetectionServiceStatus> {
  const detectorId = await resolveActiveDetectorId();
  const ready = isDetectorBackendReady(detectorId);
  const detectorFile = getDetectorModelFilename(detectorId);
  return {
    healthy: ready,
    running: ready,
    autoStarted: false,
    endpoint: "native-onnx",
    modelName: ready
      ? `${detectorFile} + w600k_r50 (native ONNX)`
      : null,
    modelPath: null,
    error: ready
      ? null
      : `Face detection model (${detectorId}) not downloaded or failed to load`,
  };
}
