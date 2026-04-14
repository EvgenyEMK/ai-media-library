import { areAllModelsDownloaded } from "./model-manager";
import { isNativeDetectorReady } from "./retinaface-detector";
import { isNativeEmbedderReady } from "./arcface-embedder";

export function isNativeBackendReady(): boolean {
  return areAllModelsDownloaded() && isNativeDetectorReady() && isNativeEmbedderReady();
}
