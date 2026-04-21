export {
  detectFacesNative,
  isNativeDetectorReady,
  resetNativeDetector,
  retinafaceDetector,
} from "./retinaface-detector";
export {
  createYoloFaceDetector,
  isYoloDetectorReady,
  resetYoloDetector,
  getYoloDetectorError,
} from "./yolo-face-detector";
export { getDetector, listDetectorIds } from "./detector-registry";
export type { FaceDetector, NativeDetectParams } from "./detector";
export {
  embedFacesNative,
  getNativeEmbeddingModelInfo,
  isNativeEmbedderReady,
  resetNativeEmbedder,
} from "./arcface-embedder";
export {
  setModelsDirectory,
  getModelsDirectory,
  isModelDownloaded,
  areAllModelsDownloaded,
  areCoreModelsDownloaded,
  ensureModelsDownloaded,
  ensureActiveModels,
  ensureDetectorModel,
  downloadModel,
  getModelFilenames,
  getDetectorModelFilename,
  isDetectorModelDownloaded,
  type DownloadProgressCallback,
} from "./model-manager";
export { isNativeBackendReady, isDetectorBackendReady } from "./backend-switch";
export {
  classifyFaceSubjectRoles,
  type FaceWithSubjectRole,
  type SubjectRoleConfig,
} from "./subject-role";
