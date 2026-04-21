import type { FaceDetectorModelId } from "../../src/shared/ipc";
import { areCoreModelsDownloaded, isDetectorModelDownloaded } from "./model-manager";
import { getDetector } from "./detector-registry";
import { isNativeEmbedderReady } from "./arcface-embedder";

/**
 * True when the given detector is cached on disk, its session is healthy,
 * and the core (embedder) model is also present.
 */
export function isDetectorBackendReady(detectorId: FaceDetectorModelId): boolean {
  if (!areCoreModelsDownloaded()) return false;
  if (!isDetectorModelDownloaded(detectorId)) return false;
  if (!isNativeEmbedderReady()) return false;
  return getDetector(detectorId).isReady();
}

/**
 * Backwards-compatible helper used by callers that haven't yet migrated to
 * the multi-detector API. Assumes the RetinaFace detector (the legacy
 * desktop default).
 */
export function isNativeBackendReady(): boolean {
  return isDetectorBackendReady("retinaface");
}
