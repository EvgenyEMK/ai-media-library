import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_FACE_DETECTION_SETTINGS,
  DEFAULT_FOLDER_SCANNING_SETTINGS,
  DEFAULT_MEDIA_VIEWER_SETTINGS,
  DEFAULT_PATH_EXTRACTION_SETTINGS,
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  type AiImageSearchSettings,
  type AppSettings,
  type FaceDetectionSettings,
  type FolderScanningSettings,
  type MediaViewerSettings,
  type PathExtractionSettings,
  type PhotoAnalysisSettings,
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
    faceDetection: sanitizeFaceDetectionSettings(parsed.faceDetection),
    photoAnalysis: sanitizePhotoAnalysisSettings(parsed.photoAnalysis),
    folderScanning: sanitizeFolderScanningSettings(parsed.folderScanning),
    aiImageSearch: sanitizeAiImageSearchSettings(parsed.aiImageSearch),
    mediaViewer: sanitizeMediaViewerSettings(parsed.mediaViewer),
    pathExtraction: sanitizePathExtractionSettings(parsed.pathExtraction),
    clientId,
  };

  if (clientId !== parsed.clientId) {
    await writeSettings(userDataPath, settings);
  }

  return settings;
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

function sanitizeFaceDetectionSettings(candidate: unknown): FaceDetectionSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
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
  };
}

function sanitizeFolderScanningSettings(candidate: unknown): FolderScanningSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
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
    enableTwoPassRotationConsistency:
      typeof value.enableTwoPassRotationConsistency === "boolean"
        ? value.enableTwoPassRotationConsistency
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.enableTwoPassRotationConsistency,
    useFaceFeaturesForRotation:
      typeof value.useFaceFeaturesForRotation === "boolean"
        ? value.useFaceFeaturesForRotation
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.useFaceFeaturesForRotation,
    extractInvoiceData:
      typeof value.extractInvoiceData === "boolean"
        ? value.extractInvoiceData
        : DEFAULT_PHOTO_ANALYSIS_SETTINGS.extractInvoiceData,
  };
}

function sanitizePathExtractionSettings(candidate: unknown): PathExtractionSettings {
  const value = isRecord(candidate) ? candidate : {};
  return {
    extractDates:
      typeof value.extractDates === "boolean"
        ? value.extractDates
        : DEFAULT_PATH_EXTRACTION_SETTINGS.extractDates,
    extractLocation:
      typeof value.extractLocation === "boolean"
        ? value.extractLocation
        : DEFAULT_PATH_EXTRACTION_SETTINGS.extractLocation,
    useLlm:
      typeof value.useLlm === "boolean"
        ? value.useLlm
        : DEFAULT_PATH_EXTRACTION_SETTINGS.useLlm,
    llmModel:
      typeof value.llmModel === "string" && value.llmModel.trim().length > 0
        ? value.llmModel.trim()
        : DEFAULT_PATH_EXTRACTION_SETTINGS.llmModel,
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
