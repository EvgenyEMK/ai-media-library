import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AUX_MODEL_OPTIONS,
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_FACE_DETECTION_SETTINGS,
  DEFAULT_FOLDER_SCANNING_SETTINGS,
  DEFAULT_MEDIA_VIEWER_SETTINGS,
  DEFAULT_PATH_EXTRACTION_SETTINGS,
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS,
  FACE_DETECTOR_MODEL_OPTIONS,
  type AiImageSearchSettings,
  type AppSettings,
  type AuxModelKind,
  type FaceAgeGenderModelId,
  type FaceDetectionSettings,
  type FaceDetectorModelId,
  type FaceLandmarkModelId,
  type FolderScanningSettings,
  type ImageOrientationModelId,
  type MediaViewerSettings,
  type PathExtractionSettings,
  type PhotoAnalysisSettings,
  type PhotoPendingFolderIconTint,
  type WrongImageRotationDetectionSettings,
} from "../src/shared/ipc";

const DEFAULT_SETTINGS: Omit<AppSettings, "clientId"> = DEFAULT_APP_SETTINGS;

export async function readSettings(userDataPath: string): Promise<AppSettings> {
  const settingsPath = getSettingsPath(userDataPath);

  let parsed: Partial<AppSettings> = {};
  try {
    const raw = await fs.readFile(settingsPath, "utf-8");
    parsed = JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    // First launch or corrupt file — start from defaults.
  }

  const clientId =
    typeof parsed.clientId === "string" && parsed.clientId.length > 0
      ? parsed.clientId
      : randomUUID();

  const settings: AppSettings = {
    libraryRoots: Array.isArray(parsed.libraryRoots) ? parsed.libraryRoots : [],
    sidebarCollapsed:
      typeof parsed.sidebarCollapsed === "boolean"
        ? parsed.sidebarCollapsed
        : false,
    wrongImageRotationDetection: sanitizeWrongImageRotationDetectionSettings(
      parsed.wrongImageRotationDetection,
      parsed.faceDetection,
      parsed.photoAnalysis,
    ),
    faceDetection: sanitizeFaceDetectionSettings(parsed.faceDetection),
    photoAnalysis: sanitizePhotoAnalysisSettings(parsed.photoAnalysis),
    folderScanning: sanitizeFolderScanningSettings(parsed.folderScanning),
    aiImageSearch: sanitizeAiImageSearchSettings(parsed.aiImageSearch),
    mediaViewer: sanitizeMediaViewerSettings(parsed.mediaViewer),
    pathExtraction: sanitizePathExtractionSettings(parsed.pathExtraction),
    aiInferencePreferredGpuId: sanitizeAiInferencePreferredGpuId(parsed.aiInferencePreferredGpuId),
    clientId,
  };

  if (clientId !== parsed.clientId) {
    await writeSettings(userDataPath, settings);
  }

  return settings;
}

function sanitizeAiInferencePreferredGpuId(candidate: unknown): string | null {
  if (typeof candidate !== "string") {
    return null;
  }
  const value = candidate.trim();
  if (value.length === 0 || value === "auto") {
    return null;
  }
  if (value.startsWith("dml:")) {
    const idx = Number.parseInt(value.slice(4), 10);
    return Number.isFinite(idx) && idx >= 0 ? `dml:${idx}` : null;
  }
  return null;
}

function sanitizeMediaViewerSettings(candidate: unknown): MediaViewerSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
    autoPlayVideoOnOpen:
      typeof value.autoPlayVideoOnOpen === "boolean"
        ? value.autoPlayVideoOnOpen
        : DEFAULT_MEDIA_VIEWER_SETTINGS.autoPlayVideoOnOpen,
    skipVideosInSlideshow:
      typeof value.skipVideosInSlideshow === "boolean"
        ? value.skipVideosInSlideshow
        : DEFAULT_MEDIA_VIEWER_SETTINGS.skipVideosInSlideshow,
  };
}

export async function writeSettings(
  userDataPath: string,
  settings: AppSettings,
): Promise<void> {
  const settingsPath = getSettingsPath(userDataPath);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
}

function getSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, "media-settings.json");
}

const VALID_DETECTOR_IDS = new Set<FaceDetectorModelId>(
  FACE_DETECTOR_MODEL_OPTIONS.map((option) => option.id),
);

function sanitizeDetectorModel(candidate: unknown): FaceDetectorModelId {
  if (typeof candidate === "string" && VALID_DETECTOR_IDS.has(candidate as FaceDetectorModelId)) {
    return candidate as FaceDetectorModelId;
  }
  return DEFAULT_FACE_DETECTION_SETTINGS.detectorModel;
}

function sanitizeFaceDetectionSettings(candidate: unknown): FaceDetectionSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
    detectorModel: sanitizeDetectorModel(value.detectorModel),
    minConfidenceThreshold: clampToRange(
      asNumber(value.minConfidenceThreshold),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.minConfidenceThreshold,
    ),
    minFaceBoxShortSideRatio: clampToRange(
      asNumber(value.minFaceBoxShortSideRatio),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.minFaceBoxShortSideRatio,
    ),
    faceBoxOverlapMergeRatio: clampToRange(
      asNumber(value.faceBoxOverlapMergeRatio),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.faceBoxOverlapMergeRatio,
    ),
    faceRecognitionSimilarityThreshold: clampToRange(
      asNumber(value.faceRecognitionSimilarityThreshold),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold,
    ),
    faceGroupPairwiseSimilarityThreshold: clampToRange(
      asNumber(value.faceGroupPairwiseSimilarityThreshold),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.faceGroupPairwiseSimilarityThreshold,
    ),
    faceGroupMinSize: Math.round(
      clampToRange(
        asNumber(value.faceGroupMinSize),
        2,
        500,
        DEFAULT_FACE_DETECTION_SETTINGS.faceGroupMinSize,
      ),
    ),
    mainSubjectMinSizeRatioToLargest: clampToRange(
      asNumber(value.mainSubjectMinSizeRatioToLargest),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinSizeRatioToLargest,
    ),
    mainSubjectMinImageAreaRatio: clampToRange(
      asNumber(value.mainSubjectMinImageAreaRatio),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinImageAreaRatio,
    ),
    preserveTaggedFacesMinIoU: clampToRange(
      asNumber(value.preserveTaggedFacesMinIoU),
      0,
      1,
      DEFAULT_FACE_DETECTION_SETTINGS.preserveTaggedFacesMinIoU,
    ),
    keepUnmatchedTaggedFaces:
      typeof value.keepUnmatchedTaggedFaces === "boolean"
        ? value.keepUnmatchedTaggedFaces
        : DEFAULT_FACE_DETECTION_SETTINGS.keepUnmatchedTaggedFaces,
    imageOrientationDetection: {
      model: sanitizeAuxToggle(
        value.imageOrientationDetection,
        "orientation",
        { enabled: true, model: DEFAULT_FACE_DETECTION_SETTINGS.imageOrientationDetection.model },
      ).model,
    },
    faceLandmarkRefinement: sanitizeAuxToggle(
      value.faceLandmarkRefinement,
      "landmarks",
      DEFAULT_FACE_DETECTION_SETTINGS.faceLandmarkRefinement,
    ),
    faceAgeGenderDetection: sanitizeAuxToggle(
      value.faceAgeGenderDetection,
      "age-gender",
      DEFAULT_FACE_DETECTION_SETTINGS.faceAgeGenderDetection,
    ),
  };
}

function sanitizeAuxToggle<
  Id extends ImageOrientationModelId | FaceLandmarkModelId | FaceAgeGenderModelId,
>(
  candidate: unknown,
  kind: AuxModelKind,
  fallback: { enabled: boolean; model: Id },
): { enabled: boolean; model: Id } {
  const value = isRecord(candidate) ? candidate : {};
  const validIds = new Set<string>(
    AUX_MODEL_OPTIONS.filter((option) => option.kind === kind).map((option) => option.id),
  );
  const modelCandidate =
    typeof value.model === "string" && validIds.has(value.model)
      ? (value.model as Id)
      : fallback.model;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    model: modelCandidate,
  };
}

function sanitizeFolderScanningSettings(candidate: unknown): FolderScanningSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
    showFolderAiSummaryWhenSelectingEmptyFolder:
      typeof value.showFolderAiSummaryWhenSelectingEmptyFolder === "boolean"
        ? value.showFolderAiSummaryWhenSelectingEmptyFolder
        : DEFAULT_FOLDER_SCANNING_SETTINGS.showFolderAiSummaryWhenSelectingEmptyFolder,
    autoMetadataScanOnSelectMaxFiles: clampToRange(
      asNumber(value.autoMetadataScanOnSelectMaxFiles),
      0,
      1_000_000,
      DEFAULT_FOLDER_SCANNING_SETTINGS.autoMetadataScanOnSelectMaxFiles,
    ),
    writeEmbeddedMetadataOnUserEdit:
      typeof value.writeEmbeddedMetadataOnUserEdit === "boolean"
        ? value.writeEmbeddedMetadataOnUserEdit
        : DEFAULT_FOLDER_SCANNING_SETTINGS.writeEmbeddedMetadataOnUserEdit,
    detectLocationFromGps:
      typeof value.detectLocationFromGps === "boolean"
        ? value.detectLocationFromGps
        : DEFAULT_FOLDER_SCANNING_SETTINGS.detectLocationFromGps,
  };
}

function sanitizeAiImageSearchSettings(candidate: unknown): AiImageSearchSettings {
  const value = isRecord(candidate) ? candidate : {};
  const legacySingle = asNumber(value.hideResultsBelowSimilarity);
  const vlmExplicit = asNumber(value.hideResultsBelowVlmSimilarity);
  const vlm = clampToRange(
    vlmExplicit,
    0,
    1,
    legacySingle !== null && vlmExplicit === null
      ? legacySingle
      : DEFAULT_AI_IMAGE_SEARCH_SETTINGS.hideResultsBelowVlmSimilarity,
  );
  const desc = clampToRange(
    asNumber(value.hideResultsBelowDescriptionSimilarity),
    0,
    1,
    DEFAULT_AI_IMAGE_SEARCH_SETTINGS.hideResultsBelowDescriptionSimilarity,
  );
  const keywordMatchThresholdVlm = clampToRange(
    asNumber(value.keywordMatchThresholdVlm),
    0,
    1,
    DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdVlm,
  );
  const keywordMatchThresholdDescription = clampToRange(
    asNumber(value.keywordMatchThresholdDescription),
    0,
    1,
    DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdDescription,
  );

  return {
    hideResultsBelowVlmSimilarity: vlm,
    hideResultsBelowDescriptionSimilarity: desc,
    showMatchingMethodSelector:
      typeof value.showMatchingMethodSelector === "boolean"
        ? value.showMatchingMethodSelector
        : DEFAULT_AI_IMAGE_SEARCH_SETTINGS.showMatchingMethodSelector,
    keywordMatchReranking:
      typeof value.keywordMatchReranking === "boolean"
        ? value.keywordMatchReranking
        : DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchReranking,
    keywordMatchThresholdVlm,
    keywordMatchThresholdDescription,
  };
}

function sanitizePhotoAnalysisSettings(candidate: unknown): PhotoAnalysisSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
    model:
      typeof value.model === "string" && value.model.trim().length > 0
        ? value.model.trim()
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.model,
    analysisTimeoutPerImageSec: clampToRange(
      asNumber(value.analysisTimeoutPerImageSec),
      10,
      1800,
      DEFAULT_PHOTO_ANALYSIS_SETTINGS.analysisTimeoutPerImageSec,
    ),
    downscaleBeforeLlm:
      typeof value.downscaleBeforeLlm === "boolean"
        ? value.downscaleBeforeLlm
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.downscaleBeforeLlm,
    downscaleLongestSidePx: clampToRange(
      asNumber(value.downscaleLongestSidePx),
      256,
      8192,
      DEFAULT_PHOTO_ANALYSIS_SETTINGS.downscaleLongestSidePx,
    ),
    enableTwoPassRotationConsistency:
      typeof value.enableTwoPassRotationConsistency === "boolean"
        ? value.enableTwoPassRotationConsistency
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.enableTwoPassRotationConsistency,
    extractInvoiceData:
      typeof value.extractInvoiceData === "boolean"
        ? value.extractInvoiceData
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.extractInvoiceData,
    folderIconWhenPhotoAnalysisPending: sanitizePhotoPendingTint(value.folderIconWhenPhotoAnalysisPending),
  };
}

function sanitizeWrongImageRotationDetectionSettings(
  candidate: unknown,
  legacyFaceDetection: unknown,
  legacyPhotoAnalysis: unknown,
): WrongImageRotationDetectionSettings {
  const value = isRecord(candidate) ? candidate : {};
  const legacyFace = isRecord(legacyFaceDetection) ? legacyFaceDetection : {};
  const legacyOrientation = isRecord(legacyFace.imageOrientationDetection)
    ? legacyFace.imageOrientationDetection
    : {};
  const legacyPhoto = isRecord(legacyPhotoAnalysis) ? legacyPhotoAnalysis : {};

  const enabled =
    typeof value.enabled === "boolean"
      ? value.enabled
      : typeof legacyOrientation.enabled === "boolean"
        ? legacyOrientation.enabled
        : DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS.enabled;

  const useFaceLandmarkFeaturesFallback =
    typeof value.useFaceLandmarkFeaturesFallback === "boolean"
      ? value.useFaceLandmarkFeaturesFallback
      : typeof legacyPhoto.useFaceFeaturesForRotation === "boolean"
        ? legacyPhoto.useFaceFeaturesForRotation
        : DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS.useFaceLandmarkFeaturesFallback;

  return {
    enabled,
    useFaceLandmarkFeaturesFallback,
  };
}

const PHOTO_PENDING_TINTS = new Set<PhotoPendingFolderIconTint>(["red", "amber", "green"]);

function sanitizePhotoPendingTint(raw: unknown): PhotoPendingFolderIconTint {
  if (raw === "gray") {
    return "green";
  }
  return typeof raw === "string" && PHOTO_PENDING_TINTS.has(raw as PhotoPendingFolderIconTint)
    ? (raw as PhotoPendingFolderIconTint)
    : DEFAULT_PHOTO_ANALYSIS_SETTINGS.folderIconWhenPhotoAnalysisPending;
}

function sanitizePathExtractionSettings(candidate: unknown): PathExtractionSettings {
  const value = isRecord(candidate) ? candidate : {};
  const legacyLlm =
    typeof value.llmModel === "string" && value.llmModel.trim().length > 0 ? value.llmModel.trim() : null;
  const primaryRaw = typeof value.llmModelPrimary === "string" ? value.llmModelPrimary.trim() : "";
  const fallbackRaw = typeof value.llmModelFallback === "string" ? value.llmModelFallback.trim() : "";

  return {
    extractDates:
      typeof value.extractDates === "boolean"
        ? value.extractDates
        : DEFAULT_PATH_EXTRACTION_SETTINGS.extractDates,
    useLlm:
      typeof value.useLlm === "boolean"
        ? value.useLlm
        : DEFAULT_PATH_EXTRACTION_SETTINGS.useLlm,
    llmModelPrimary:
      primaryRaw.length > 0
        ? primaryRaw
        : legacyLlm ?? DEFAULT_PATH_EXTRACTION_SETTINGS.llmModelPrimary,
    llmModelFallback:
      fallbackRaw.length > 0 ? fallbackRaw : DEFAULT_PATH_EXTRACTION_SETTINGS.llmModelFallback,
  };
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampToRange(value: number | null, min: number, max: number, fallback: number): number {
  if (value === null) return fallback;
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
