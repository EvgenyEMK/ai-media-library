import type {
  AlbumItemsRequest,
  AlbumItemsResult,
  AlbumListRequest,
  AlbumListResult,
  AlbumMembership,
  CanonicalBoundingBox,
  FaceBeingBoundingBox,
  MediaAlbumSummary,
  ProviderRawBoundingBoxReference,
  SmartAlbumItemsRequest,
  SmartAlbumYearsRequest,
  SmartAlbumPlacesRequest,
  SmartAlbumPlacesResult,
  SmartAlbumYearsResult,
} from "@emk/shared-contracts";
import { DEFAULT_SMART_ALBUM_EXCLUDED_IMAGE_CATEGORIES } from "@emk/shared-contracts";
import type { SemanticSearchSignalMode } from "@emk/media-store";
import type { PipelineDesktopApi } from "./pipeline-ipc";
import type { PipelineConcurrencyConfig } from "./pipeline-types";
import { DEFAULT_PIPELINE_CONCURRENCY } from "./pipeline-types";

export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".tif",
  ".tiff",
]);

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
]);

export type MediaKind = "image" | "video";

/** Classify catalog row kind from MIME (if known) and file path extension. Defaults to image. */
export function inferCatalogMediaKind(sourcePath: string, mimeType: string | null | undefined): MediaKind {
  const m = (mimeType ?? "").trim().toLowerCase();
  if (m.startsWith("video/")) {
    return "video";
  }
  if (m.startsWith("image/")) {
    return "image";
  }
  const lower = sourcePath.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  return "image";
}

export const IPC_CHANNELS = {
  selectLibraryFolder: "media:select-library-folder",
  readFolderChildren: "media:read-folder-children",
  pruneFolderAnalysisForMissingChildren: "media:prune-folder-analysis-for-missing-children",
  /** Opens the OS file manager with the given file selected (Electron `shell.showItemInFolder`). */
  revealItemInFolder: "media:reveal-item-in-folder",
  listFolderImages: "media:list-folder-images",
  startFolderImagesStream: "media:start-folder-images-stream",
  folderImagesProgress: "media:folder-images-progress",
  listFolderMedia: "media:list-folder-media",
  startFolderMediaStream: "media:start-folder-media-stream",
  folderMediaProgress: "media:folder-media-progress",
  getSettings: "media:get-settings",
  getDatabaseLocation: "media:get-database-location",
  saveSettings: "media:save-settings",
  getAiInferenceGpuOptions: "media:get-ai-inference-gpu-options",
  getFolderAnalysisStatuses: "media:get-folder-analysis-statuses",
  analyzeFolderPhotos: "media:analyze-folder-photos",
  cancelPhotoAnalysis: "media:cancel-photo-analysis",
  photoAnalysisProgress: "media:photo-analysis-progress",
  detectFolderFaces: "media:detect-folder-faces",
  cancelFaceDetection: "media:cancel-face-detection",
  faceDetectionProgress: "media:face-detection-progress",
  getFaceDetectionServiceStatus: "media:get-face-detection-service-status",
  indexFolderSemanticEmbeddings: "media:index-folder-semantic-embeddings",
  indexDescriptionEmbeddings: "media:index-description-embeddings",
  // TEMPORARY: description embedding backfill — remove after migration
  descEmbedBackfillProgress: "media:desc-embed-backfill-progress",
  cancelDescEmbedBackfill: "media:cancel-desc-embed-backfill",
  semanticSearchPhotos: "media:semantic-search-photos",
  cancelSemanticEmbeddingIndex: "media:cancel-semantic-embedding-index",
  getSemanticEmbeddingStatus: "media:get-semantic-embedding-status",
  getSemanticIndexDebugLogTail: "media:get-semantic-index-debug-log-tail",
  semanticIndexProgress: "media:semantic-index-progress",
  scanFolderMetadata: "media:scan-folder-metadata",
  cancelMetadataScan: "media:cancel-metadata-scan",
  metadataScanProgress: "media:metadata-scan-progress",
  getMediaItemsByPaths: "media:get-media-items-by-paths",
  setMediaItemStarRating: "media:set-media-item-star-rating",
  listAlbums: "media:list-albums",
  createAlbum: "media:create-album",
  updateAlbumTitle: "media:update-album-title",
  deleteAlbum: "media:delete-album",
  listAlbumItems: "media:list-album-items",
  listAlbumsForMediaItem: "media:list-albums-for-media-item",
  addMediaItemsToAlbum: "media:add-media-items-to-album",
  removeMediaItemFromAlbum: "media:remove-media-item-from-album",
  setAlbumCover: "media:set-album-cover",
  listSmartAlbumPlaces: "media:list-smart-album-places",
  listSmartAlbumYears: "media:list-smart-album-years",
  listSmartAlbumItems: "media:list-smart-album-items",
  /** Pushed from main → renderer after a background file-metadata write refreshes the catalog row. */
  mediaItemMetadataRefreshed: "media:media-item-metadata-refreshed",
  listPersonTags: "media:list-person-tags",
  listPersonTagsWithFaceCounts: "media:list-person-tags-with-face-counts",
  listPersonGroups: "media:list-person-groups",
  createPersonGroup: "media:create-person-group",
  setPersonTagGroups: "media:set-person-tag-groups",
  getPersonTagGroupsForTagIds: "media:get-person-tag-groups-for-tag-ids",
  updatePersonGroupName: "media:update-person-group-name",
  deletePersonGroup: "media:delete-person-group",
  listPersonTagsInGroup: "media:list-person-tags-in-group",
  getClusterPersonMatchStatsBatch: "media:get-cluster-person-match-stats-batch",
  getClusterMemberFaceIdsForPersonSimilarityFilter:
    "media:get-cluster-member-face-ids-for-person-similarity-filter",
  getSimilarUntaggedFaceCountsForTags: "media:get-similar-untagged-face-counts-for-tags",
  startSimilarUntaggedFaceCountsJob: "media:start-similar-untagged-face-counts-job",
  cancelSimilarUntaggedFaceCountsJob: "media:cancel-similar-untagged-face-counts-job",
  similarUntaggedCountsProgress: "media:similar-untagged-counts-progress",
  createPersonTag: "media:create-person-tag",
  updatePersonTagLabel: "media:update-person-tag-label",
  updatePersonTagBirthDate: "media:update-person-tag-birth-date",
  getPersonTagDeleteUsage: "media:get-person-tag-delete-usage",
  deletePersonTag: "media:delete-person-tag",
  setPersonTagPinned: "media:set-person-tag-pinned",
  listFaceInstancesForMediaItem: "media:list-face-instances-for-media-item",
  assignPersonTagToFace: "media:assign-person-tag-to-face",
  assignPersonTagsToFaces: "media:assign-person-tags-to-faces",
  refreshPersonSuggestionsForTag: "media:refresh-person-suggestions-for-tag",
  recomputePersonCentroid: "media:recompute-person-centroid",
  clearPersonTagFromFace: "media:clear-person-tag-from-face",
  deleteFaceInstance: "media:delete-face-instance",
  detectFacesForMediaItem: "media:detect-faces-for-media-item",
  embedFolderFaces: "media:embed-folder-faces",
  cancelFaceEmbedding: "media:cancel-face-embedding",
  faceEmbeddingProgress: "media:face-embedding-progress",
  getEmbeddingModelStatus: "media:get-embedding-model-status",
  getEmbeddingStats: "media:get-embedding-stats",
  searchSimilarFaces: "media:search-similar-faces",
  suggestPersonTagForFace: "media:suggest-person-tag-for-face",
  findPersonMatches: "media:find-person-matches",
  getFaceClusters: "media:get-face-clusters",
  listClusterFaceIds: "media:list-cluster-face-ids",
  runFaceClustering: "media:run-face-clustering",
  cancelFaceClustering: "media:cancel-face-clustering",
  faceClusteringProgress: "media:face-clustering-progress",
  assignClusterToPerson: "media:assign-cluster-to-person",
  suggestPersonTagForCluster: "media:suggest-person-tag-for-cluster",
  suggestPersonTagsForClusters: "media:suggest-person-tags-for-clusters",
  getFaceCropPaths: "media:get-face-crop-paths",
  listFacesForPerson: "media:list-faces-for-person",
  reprocessFaceCropsAndEmbeddings: "media:reprocess-face-crops-embeddings",
  getFaceInfoByIds: "media:get-face-info-by-ids",
  getFaceToPersonCentroidSimilarities: "media:get-face-to-person-centroid-similarities",
  refreshPersonSuggestions: "media:refresh-person-suggestions",
  purgeDeletedMediaItems: "media:purge-deleted-media-items",
  purgeSoftDeletedMediaItemsByIds: "media:purge-soft-deleted-media-items-by-ids",
  getFolderAiSummaryOverview: "media:get-folder-ai-summary-overview",
  getFolderTreeScanSummary: "media:get-folder-tree-scan-summary",
  getFolderAiSummaryReport: "media:get-folder-ai-summary-report",
  getFolderFaceSummaryReport: "media:get-folder-face-summary-report",
  startFolderFaceSummaryStream: "media:start-folder-face-summary-stream",
  cancelFolderFaceSummaryStream: "media:cancel-folder-face-summary-stream",
  folderFaceSummaryProgress: "media:folder-face-summary-progress",
  startFolderAiSummaryStream: "media:start-folder-ai-summary-stream",
  cancelFolderAiSummaryStream: "media:cancel-folder-ai-summary-stream",
  folderAiSummaryStreamProgress: "media:folder-ai-summary-stream-progress",
  getFolderAiFailedFiles: "media:get-folder-ai-failed-files",
  getFolderAiWronglyRotatedImages: "media:get-folder-ai-wrongly-rotated-images",
  getFolderAiCoverage: "media:get-folder-ai-coverage",
  getFolderAiRollupsBatch: "media:get-folder-ai-rollups-batch",
  detectFolderImageRotation: "media:detect-folder-image-rotation",
  cancelImageRotationDetection: "media:cancel-image-rotation-detection",
  imageRotationProgress: "media:image-rotation-progress",
  faceModelDownloadProgress: "media:face-model-download-progress",
  ensureDetectorModel: "media:ensure-detector-model",
  /**
   * Ensure an auxiliary face-pipeline ONNX model (orientation classifier,
   * landmark refiner, or age/gender estimator) is on disk. Emits progress
   * on the shared `faceModelDownloadProgress` channel.
   */
  ensureAuxModel: "media:ensure-aux-model",
  analyzeFolderPathMetadata: "media:analyze-folder-path-metadata",
  cancelPathAnalysis: "media:cancel-path-analysis",
  pathAnalysisProgress: "media:path-analysis-progress",
  getGeocoderCacheStatus: "media:get-geocoder-cache-status",
  initGeocoder: "media:init-geocoder",
  geocoderInitProgress: "media:geocoder-init-progress",
} as const;

export interface AiInferenceGpuOption {
  id: string;
  label: string;
  dmlDeviceId: number | null;
  source: "auto" | "detected";
}

export interface AppSettings {
  libraryRoots: string[];
  sidebarCollapsed: boolean;
  hideAdvancedSettings: boolean;
  wrongImageRotationDetection: WrongImageRotationDetectionSettings;
  faceDetection: FaceDetectionSettings;
  photoAnalysis: PhotoAnalysisSettings;
  folderScanning: FolderScanningSettings;
  smartAlbums: SmartAlbumSettings;
  aiImageSearch: AiImageSearchSettings;
  mediaViewer: MediaViewerSettings;
  pathExtraction: PathExtractionSettings;
  aiInferencePreferredGpuId: string | null;
  /**
   * Per-group concurrency limits used by the pipeline scheduler. Defaults
   * preserve today's behaviour (heavy AI pipelines stay strictly serial).
   * Advanced users may relax these to allow more parallelism.
   */
  pipelineConcurrency: PipelineConcurrencyConfig;
  clientId: string;
}

export interface MediaViewerSettings {
  /** Start playback automatically when a video is selected in viewer (open, strip click, prev/next). */
  autoPlayVideoOnOpen: boolean;
  /** In slideshow mode, skip video slides instead of playing them to completion. */
  skipVideosInSlideshow: boolean;
}

export interface DatabaseLocationInfo {
  appDataPath: string;
  userDataPath: string;
  dbFileName: string;
  dbPath: string;
  modelsPath: string;
  geonamesPath: string;
  cachePath: string;
  /** Temporary troubleshooting signal for packaged legacy DB compatibility checks. */
  mediaEmbeddingsCompatStatus?: string;
  semanticDebugLogPath?: string | null;
}

export interface PathExtractionSettings {
  extractDates: boolean;
  useLlm: boolean;
  /** First Ollama text model id to try for path-metadata LLM (must match `ollama list` names). */
  llmModelPrimary: string;
  /** Second choice if the primary id is not installed locally. */
  llmModelFallback: string;
}

/**
 * Identifier for the face-detection model variant.
 * All variants produce 5-point landmarks in RetinaFace order so rotation
 * inference works identically across them.
 */
export type FaceDetectorModelId =
  | "retinaface"
  | "yolov12n-face"
  | "yolov12s-face"
  | "yolov12m-face"
  | "yolov12l-face";

export interface FaceDetectionSettings {
  /** Active face-detection model; switching triggers an on-demand download if not yet cached. */
  detectorModel: FaceDetectorModelId;
  minConfidenceThreshold: number;
  minFaceBoxShortSideRatio: number;
  faceBoxOverlapMergeRatio: number;
  /**
   * Minimum cosine similarity between an untagged face embedding and a person centroid
   * to write a row to `media_item_person_suggestions` (unconfirmed similar faces).
   */
  faceRecognitionSimilarityThreshold: number;
  /**
   * Minimum cosine similarity between two untagged face embeddings required to link them
   * into the same provisional group when running “Find groups” (People → Untagged faces).
   */
  faceGroupPairwiseSimilarityThreshold: number;
  /**
   * Minimum number of faces in a provisional group after “Find groups”; smaller groups are discarded.
   */
  faceGroupMinSize: number;
  /**
   * A face is classified as `main` subject when its short side is at least this fraction
   * of the largest detected face's short side. Otherwise it is `background`.
   * Example: with 0.5, a face half as tall as the biggest face is still `main`.
   */
  mainSubjectMinSizeRatioToLargest: number;
  /**
   * Absolute floor: a face must also cover at least this fraction of the full image area
   * to qualify as `main`. Protects against photos where all faces are tiny background faces.
   */
  mainSubjectMinImageAreaRatio: number;
  /**
   * Minimum IoU between a newly-detected face box and a previously-tagged face box required
   * to carry the person tag (and cached embedding) over to the newly-detected instance when
   * re-running the pipeline with "Override existing".
   */
  preserveTaggedFacesMinIoU: number;
  /**
   * When true, previously-tagged face boxes that do NOT match any newly-detected box are kept
   * in the DB (so the user does not silently lose a person tag if the new detector misses a face).
   * When false, re-running detection replaces all `source='auto'` rows (old behavior).
   */
  keepUnmatchedTaggedFaces: boolean;
  /** Model selection for the global wrong-rotation precheck classifier. */
  imageOrientationDetection: {
    model: ImageOrientationModelId;
  };
  /**
   * Per-face 5-point landmark refinement (PFLD_GhostOne). Runs after bbox detection on YOLO
   * models that emit no landmarks; produces aligned crops for ArcFace and fills
   * `detected_features` so similarity scoring works on all detectors.
   */
  faceLandmarkRefinement: {
    enabled: boolean;
    model: FaceLandmarkModelId;
  };
  /**
   * Estimates age and gender per detected face (ViT, Apache-2.0). Persisted to
   * `media_face_instances` and displayed in the Face tags panel.
   */
  faceAgeGenderDetection: {
    enabled: boolean;
    model: FaceAgeGenderModelId;
  };
}

/** Auxiliary (non-detector) face-pipeline model categories. */
export type AuxModelKind = "orientation" | "landmarks" | "age-gender";

export type ImageOrientationModelId = "deep-image-orientation-v1";
export type FaceLandmarkModelId = "pfld-ghostone";
export type FaceAgeGenderModelId = "onnx-age-gender-v1";

export type AuxModelId =
  | ImageOrientationModelId
  | FaceLandmarkModelId
  | FaceAgeGenderModelId;

export interface AuxModelOption {
  kind: AuxModelKind;
  id: AuxModelId;
  label: string;
  approxSizeMb: number;
  description: string;
  licenseNote: string;
}

/**
 * Static catalog of auxiliary models the app may download. Entries are keyed by `{kind, id}`
 * and mirrored in `electron/native-face/model-manager.ts` for download URLs.
 */
export const AUX_MODEL_OPTIONS: readonly AuxModelOption[] = [
  {
    kind: "orientation",
    id: "deep-image-orientation-v1",
    label: "Deep Image Orientation (EfficientNetV2)",
    approxSizeMb: 80,
    description:
      "Classifies the whole image into 0°/90°/180°/270° and suggests the correction angle.",
    licenseNote: "Apache-2.0",
  },
  {
    kind: "landmarks",
    id: "pfld-ghostone",
    label: "PFLD GhostOne (98-point landmarks)",
    approxSizeMb: 3,
    description:
      "Refines 5-point face landmarks for ArcFace alignment and fills `detected_features`.",
    licenseNote: "Apache-2.0",
  },
  {
    kind: "age-gender",
    id: "onnx-age-gender-v1",
    label: "Age + Gender (ViT)",
    approxSizeMb: 90,
    description: "Estimates age and gender per detected face.",
    licenseNote: "Apache-2.0",
  },
] as const;

export interface FaceDetectorModelOption {
  id: FaceDetectorModelId;
  label: string;
  approxSizeMb: number;
  description: string;
}

export const FACE_DETECTOR_MODEL_OPTIONS: readonly FaceDetectorModelOption[] = [
  {
    id: "retinaface",
    label: "RetinaFace (MobileNetV2)",
    approxSizeMb: 7,
    description: "Old lightweight model. Research use only (see license).",
  },
  {
    id: "yolov12n-face",
    label: "YOLOv12 Nano",
    approxSizeMb: 11,
    description: "YOLOv12 Nano — newest Nano, very fast.",
  },
  {
    id: "yolov12s-face",
    label: "YOLOv12 Small",
    approxSizeMb: 38,
    description: "Recommended YOLO default — balanced accuracy/speed.",
  },
  {
    id: "yolov12m-face",
    label: "YOLOv12 Medium",
    approxSizeMb: 79,
    description: "Higher accuracy on small / distant faces.",
  },
  {
    id: "yolov12l-face",
    label: "YOLOv12 Large",
    approxSizeMb: 102,
    description: "Best accuracy, slowest inference.",
  },
] as const;

/** Sidebar folder icon tint when face + AI search are complete but image analysis is still pending. */
export type PhotoPendingFolderIconTint = "red" | "amber" | "green";

export interface PhotoAnalysisSettings {
  /** Default vision model to use for folder Image AI analysis runs. */
  model: string;
  analysisTimeoutPerImageSec: number;
  /**
   * When true, shrink images so the longest edge is at most `downscaleLongestSidePx` before base64-encoding for Ollama.
   * Reduces memory use and failures on very large files.
   */
  downscaleBeforeLlm: boolean;
  /** Longest edge in pixels when `downscaleBeforeLlm` is true (typical range 512–2048). */
  downscaleLongestSidePx: number;
  enableTwoPassRotationConsistency: boolean;
  extractInvoiceData: boolean;
  /**
   * When face detection and AI search indexing are complete for a subtree but image analysis is not,
   * the folder list uses this color instead of the default “not done” (red) or “partial” (amber) styling.
   * `green` matches the “all pipelines complete” square (success); use when you want a calm, complete look.
   */
  folderIconWhenPhotoAnalysisPending: PhotoPendingFolderIconTint;
}

export interface WrongImageRotationDetectionSettings {
  /**
   * Analyze image rotation need before running AI pipelines (semantic index,
   * face detection, AI image analysis). If already processed for a media item,
   * later pipelines skip re-running the check.
   */
  enabled: boolean;
  /**
   * Fallback method: if classifier is unavailable or cannot provide a usable
   * signal, try face landmark features (when available) to infer orientation.
   */
  useFaceLandmarkFeaturesFallback: boolean;
}

/** How quick scan pairs "deleted + new" file rows as moves under a scanned tree. */
export type QuickScanMovedFileMatchMode = "name-size" | "content-hash";

export interface FolderTreeQuickScanMoveItem {
  filename: string;
  fromFolderPath: string;
  toFolderPath: string;
  previousPath: string;
  newPath: string;
}

/**
 * Result of normal + ultra folder-tree quick scans (see main-process `[debug][folder-tree-scan]`).
 *
 * **Folder-level `metadata_scanned_at` vs per-file `metadata_extracted_at`:** a directory can show
 * `metadata_scanned_at` set after a metadata folder scan even if some files under it still have
 * `metadata_extracted_at` null (e.g. new files added later, failed extraction, or not yet processed).
 * Coverage % and “missing full scan” use only folders with **direct** image/video files on disk
 * (denominator `treeFoldersWithDirectMediaOnDiskCount`); container-only dirs are excluded.
 */
export interface FolderTreeQuickScanResult {
  ultraFastScanMs: number;
  normalScanMs: number;
  /** Disk layout walk + catalog diff (same wall time as interactive “normal” quick scan when ultra is off). */
  normalTotalMs: number;
  ultraChangedFolderCount: number;
  /** Directories visited during the quick-scan disk walk (includes the root folder). */
  ultraFoldersScanned: number;
  ultraBaselineSeeded: boolean;
  /** Walked folders that have ≥1 direct image/video on disk (coverage denominator). */
  treeFoldersWithDirectMediaOnDiskCount: number;
  /** Among those, count with `folder_analysis_status.metadata_scanned_at` set (coverage numerator). */
  treeFoldersWithMetadataFolderScanCount: number;
  /** Oldest `metadata_scanned_at` among direct-media folders that have it; drives amber when fully covered. */
  oldestMetadataFolderScanAtAmongWalkedFolders: string | null;
  newFileCount: number;
  modifiedFileCount: number;
  deletedFileCount: number;
  movedFileCount: number;
  newOrModifiedFolderCount: number;
  movedMatchModeUsed: QuickScanMovedFileMatchMode;
  deletedSamplePaths: string[];
  movedItems: FolderTreeQuickScanMoveItem[];
  newSamplePaths: string[];
  modifiedSamplePaths: string[];
}

/** Single-folder image count threshold for automatic metadata scan after folder selection. */
export interface FolderScanningSettings {
  /**
   * When true, selecting a folder with no direct media files but with sub-folders opens the Folder AI analysis summary
   * (same as the folder right-click action). Ignored when the folder has no sub-folders.
   */
  showFolderAiSummaryWhenSelectingEmptyFolder: boolean;
  /** Run automatic scan only when image count in the selected folder (non-recursive) is strictly less than this. */
  autoMetadataScanOnSelectMaxFiles: number;
  /**
   * When true, propagate rating (and future title/description) edits into embedded file metadata via ExifTool.
   * Default off so the database can diverge from files until the user opts in.
   */
  writeEmbeddedMetadataOnUserEdit: boolean;
  /**
   * When true, reverse-geocode GPS coordinates (latitude/longitude) during metadata scan
   * to populate country, state/province, and city fields.
   * Default off — first enable triggers a ~2 GB GeoNames data download.
   */
  detectLocationFromGps: boolean;
  /** Mark folder scan freshness as outdated when the oldest scan in the tree is older than this many days. */
  markFolderScanOutdatedAfterDays: number;
  /**
   * When pairing "deleted + new" paths as moves in the normal quick scan: match by filename + size (fast),
   * or verify with SHA-256 of the new file vs catalog `content_hash` (slower, fewer false positives).
   */
  quickScanMovedFileMatchMode: QuickScanMovedFileMatchMode;
}

export interface AiImageSearchSettings {
  /**
   * Hide grid items when both VLM (image) and AI-description cosine scores are strictly
   * below their respective thresholds (see `hideResultsBelowDescriptionSimilarity`).
   */
  hideResultsBelowVlmSimilarity: number;
  /** Cosine similarity vs AI title+description text embedding; paired with VLM threshold for display filter. */
  hideResultsBelowDescriptionSimilarity: number;
  /** Exact Ollama model id used for search-prompt translation / query understanding. */
  searchPromptTranslationModel: string;
  /**
   * When true, Advanced search re-orders results using LLM keyword hits (after RRF).
   * When false, keyword thresholds below are ignored and re-ranking is skipped.
   */
  keywordMatchReranking: boolean;
  /**
   * Min cosine similarity for counting a keyword hit against the image **VLM** embedding (Advanced search re-rank).
   * **0** disables the VLM limb for keyword hits (description may still apply in hybrid).
   */
  keywordMatchThresholdVlm: number;
  /**
   * Min cosine similarity for counting a keyword hit against the **AI description** embedding (Advanced search re-rank).
   * **0** disables the description limb for keyword hits.
   */
  keywordMatchThresholdDescription: number;
}

export type SmartAlbumRatingOperator = "gte" | "eq";

export interface SmartAlbumSettings {
  defaultStarRating: number | null;
  defaultStarRatingOperator: SmartAlbumRatingOperator;
  defaultAiRating: number | null;
  defaultAiRatingOperator: SmartAlbumRatingOperator;
  excludedImageCategories: string[];
}

/** Known smart-album exclusion patterns (checkboxes in Settings). Order matches persisted defaults. */
export const SMART_ALBUM_EXCLUDABLE_IMAGE_CATEGORY_OPTIONS: ReadonlyArray<{ pattern: string; label: string }> = [
  { pattern: "document*", label: "Document-like images" },
  { pattern: "*screenshot*", label: "Screenshots" },
  { pattern: "invoice_or_receipt", label: "Invoices and receipts" },
  { pattern: "presentation_slide", label: "Presentation slides" },
  { pattern: "diagram", label: "Diagrams" },
];

export const DEFAULT_FACE_DETECTION_SETTINGS: FaceDetectionSettings = {
  detectorModel: "yolov12l-face",
  minConfidenceThreshold: 0.75,
  minFaceBoxShortSideRatio: 0.03,
  faceBoxOverlapMergeRatio: 0.5,
  faceRecognitionSimilarityThreshold: 0.38,
  faceGroupPairwiseSimilarityThreshold: 0.55,
  faceGroupMinSize: 4,
  mainSubjectMinSizeRatioToLargest: 0.5,
  mainSubjectMinImageAreaRatio: 0.01,
  preserveTaggedFacesMinIoU: 0.5,
  keepUnmatchedTaggedFaces: true,
  imageOrientationDetection: {
    model: "deep-image-orientation-v1",
  },
  faceLandmarkRefinement: {
    enabled: true,
    model: "pfld-ghostone",
  },
  faceAgeGenderDetection: {
    enabled: true,
    model: "onnx-age-gender-v1",
  },
};

export const DEFAULT_PHOTO_ANALYSIS_SETTINGS: PhotoAnalysisSettings = {
  model: "qwen3.5:9b",
  analysisTimeoutPerImageSec: 120,
  downscaleBeforeLlm: true,
  downscaleLongestSidePx: 1024,
  enableTwoPassRotationConsistency: true,
  extractInvoiceData: true,
  folderIconWhenPhotoAnalysisPending: "amber",
};

export const DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS: WrongImageRotationDetectionSettings = {
  enabled: true,
  useFaceLandmarkFeaturesFallback: true,
};

export const DEFAULT_FOLDER_SCANNING_SETTINGS: FolderScanningSettings = {
  showFolderAiSummaryWhenSelectingEmptyFolder: true,
  autoMetadataScanOnSelectMaxFiles: 100,
  writeEmbeddedMetadataOnUserEdit: false,
  detectLocationFromGps: false,
  markFolderScanOutdatedAfterDays: 7,
  quickScanMovedFileMatchMode: "name-size",
};

export const DEFAULT_AI_IMAGE_SEARCH_SETTINGS: AiImageSearchSettings = {
  hideResultsBelowVlmSimilarity: 0.04,
  hideResultsBelowDescriptionSimilarity: 0.6,
  searchPromptTranslationModel: "qwen2.5vl:3b",
  keywordMatchReranking: false,
  keywordMatchThresholdVlm: 0.05,
  keywordMatchThresholdDescription: 0.5,
};

export const DEFAULT_SMART_ALBUM_SETTINGS: SmartAlbumSettings = {
  defaultStarRating: 3,
  defaultStarRatingOperator: "gte",
  defaultAiRating: 4,
  defaultAiRatingOperator: "gte",
  excludedImageCategories: [...DEFAULT_SMART_ALBUM_EXCLUDED_IMAGE_CATEGORIES],
};

export const DEFAULT_PATH_EXTRACTION_SETTINGS: PathExtractionSettings = {
  extractDates: true,
  useLlm: false,
  llmModelPrimary: "qwen2.5vl:3b",
  llmModelFallback: "qwen3.5:9b",
};

export const DEFAULT_MEDIA_VIEWER_SETTINGS: MediaViewerSettings = {
  autoPlayVideoOnOpen: true,
  skipVideosInSlideshow: false,
};

export const DEFAULT_APP_SETTINGS: Omit<AppSettings, "clientId"> = {
  libraryRoots: [],
  sidebarCollapsed: false,
  hideAdvancedSettings: true,
  wrongImageRotationDetection: DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS,
  faceDetection: DEFAULT_FACE_DETECTION_SETTINGS,
  photoAnalysis: DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  folderScanning: DEFAULT_FOLDER_SCANNING_SETTINGS,
  smartAlbums: DEFAULT_SMART_ALBUM_SETTINGS,
  aiImageSearch: DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  mediaViewer: DEFAULT_MEDIA_VIEWER_SETTINGS,
  pathExtraction: DEFAULT_PATH_EXTRACTION_SETTINGS,
  aiInferencePreferredGpuId: null,
  pipelineConcurrency: DEFAULT_PIPELINE_CONCURRENCY,
};

export interface FolderNode {
  path: string;
  name: string;
  hasSubdirectories: boolean;
}

export interface MediaImageItem {
  path: string;
  name: string;
  url: string;
}

export interface MediaLibraryItem {
  path: string;
  name: string;
  url: string;
  mediaKind: MediaKind;
}

export type FolderImagesProgressEvent =
  | {
      type: "started";
      requestId: string;
      folderPath: string;
      total: number | null;
      loaded: number;
    }
  | {
      type: "batch";
      requestId: string;
      folderPath: string;
      total: number | null;
      loaded: number;
      items: MediaImageItem[];
    }
  | {
      type: "completed";
      requestId: string;
      folderPath: string;
      total: number | null;
      loaded: number;
    }
  | {
      type: "failed";
      requestId: string;
      folderPath: string;
      error: string;
    };

export type FolderImagesProgressListener = (event: FolderImagesProgressEvent) => void;

export type FolderMediaProgressEvent =
  | {
      type: "started";
      requestId: string;
      folderPath: string;
      total: number | null;
      loaded: number;
    }
  | {
      type: "batch";
      requestId: string;
      folderPath: string;
      total: number | null;
      loaded: number;
      items: MediaLibraryItem[];
    }
  | {
      type: "completed";
      requestId: string;
      folderPath: string;
      total: number | null;
      loaded: number;
    }
  | {
      type: "failed";
      requestId: string;
      folderPath: string;
      error: string;
    };

export type FolderMediaProgressListener = (event: FolderMediaProgressEvent) => void;

export interface FolderStreamRequest {
  folderPath: string;
  suppressAutoMetadataScan?: boolean;
}

export type DesktopPhotoTakenPrecision = "year" | "month" | "day" | "instant";

export interface DesktopMediaItemMetadata {
  id: string;
  sourcePath: string;
  filename: string;
  mimeType: string | null;
  /** Catalog kind; falls back to inference from path/MIME when the column is unset. */
  mediaKind: MediaKind;
  /** Container duration in seconds when known (video). */
  videoDurationSec: number | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  fileMtimeMs: number | null;
  orientation: number | null;
  fileCreatedAt: string | null;
  photoTakenAt: string | null;
  photoTakenPrecision: DesktopPhotoTakenPrecision | null;
  /** Resolved event window from path/EXIF/catalog (ISO date strings). */
  eventDateStart: string | null;
  eventDateEnd: string | null;
  embeddedTitle: string | null;
  embeddedDescription: string | null;
  embeddedLocation: string | null;
  /** XMP / Windows EXIF: -1 rejected, 0 unrated, 1–5 stars (see `docs/UX/media-library/FILE-STAR-RATING.md`). */
  starRating: number | null;
  latitude: number | null;
  longitude: number | null;
  /** Denormalized location fields for search and quick filters. */
  country: string | null;
  city: string | null;
  locationArea: string | null;
  /** GeoNames admin2 (e.g. county) when from GPS; null otherwise. */
  locationArea2: string | null;
  locationPlace: string | null;
  locationName: string | null;
  /** Catalog location provenance (`gps`, `path_llm`, `path_script`, `ai_vision`, ...). */
  locationSource: string | null;
  displayTitle: string | null;
  checksumSha256: string | null;
  contentHash: string | null;
  duplicateGroupId: string | null;
  metadataExtractedAt: string | null;
  metadataVersion: string | null;
  metadataError: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLengthMm: number | null;
  fNumber: number | null;
  exposureTime: string | null;
  iso: number | null;
  faceConfidences: Array<number | null>;
  sourceCount: number;
  updatedAt: string;
  aiMetadata: unknown | null;
}

export interface SetMediaItemStarRatingRequest {
  sourcePath: string;
  /** Integer 0–5 (0 = unrated / clear). */
  starRating: number;
}

export interface SetMediaItemStarRatingResult {
  success: boolean;
  error?: string;
  /** Populated when ExifTool / refresh failed after DB update. */
  fileWriteError?: string;
  metadata?: DesktopMediaItemMetadata;
}

export type FolderAnalysisState = "not_scanned" | "in_progress" | "analyzed";

export interface FolderAnalysisStatus {
  state: FolderAnalysisState;
  photoAnalyzedAt: string | null;
  faceAnalyzedAt: string | null;
  semanticIndexedAt: string | null;
  metadataScannedAt: string | null;
  lastUpdatedAt: string | null;
}

export type FolderAiPipelineLabel = "empty" | "done" | "not_done" | "partial";

/** Subtree rollup for sidebar folder health (from DB aggregates, recursive). */
export type FolderAiSidebarRollup =
  | "empty"
  | "all_done"
  | "partial"
  | "not_done"
  /** Face + search index complete; image analysis still pending (icon color from settings). */
  | "photo_analysis_waiting";

export interface FolderAiPipelineCounts {
  doneCount: number;
  failedCount: number;
  totalImages: number;
  label: FolderAiPipelineLabel;
  issueCount?: number;
  imagesWithFacesCount?: number;
  imagesWithTaggedFacesCount?: number;
}

export interface FolderGeoMediaCoverage {
  total: number;
  withGpsCount: number;
  withoutGpsCount: number;
  locationDetailsDoneCount: number;
}

export interface FolderGeoLocationDetailsCoverage {
  doneCount: number;
  totalWithGps: number;
  label: FolderAiPipelineLabel;
}

export interface FolderGeoPathLlmCoverage {
  doneCount: number;
  totalImages: number;
  /** Images with non-null path_llm `country` or `country_code` in `ai_metadata.locations_by_source`. */
  filesWithCountry: number;
  /** Images with non-null path_llm area in `ai_metadata.locations_by_source`. */
  filesWithArea: number;
  /** Images with non-null path_llm city in `ai_metadata.locations_by_source`. */
  filesWithCity: number;
  label: FolderAiPipelineLabel;
}

export interface FolderGeoCoverageReport {
  images: FolderGeoMediaCoverage;
  videos: FolderGeoMediaCoverage;
  locationDetails: FolderGeoLocationDetailsCoverage;
  pathLlmLocationDetails?: FolderGeoPathLlmCoverage;
}

export interface FolderAiCoverageReport {
  folderPath: string;
  recursive: boolean;
  totalImages: number;
  photo: FolderAiPipelineCounts;
  face: FolderAiPipelineCounts;
  semantic: FolderAiPipelineCounts;
  rotation: FolderAiPipelineCounts;
  geo: FolderGeoCoverageReport;
}

export interface FolderAiSummaryReport {
  selectedWithSubfolders: FolderAiCoverageReport;
  selectedDirectOnly: FolderAiCoverageReport;
  subfolders: Array<{
    folderPath: string;
    name: string;
    coverage: FolderAiCoverageReport;
  }>;
}

export interface FolderFaceTopPersonTag {
  tagId: string;
  label: string;
  taggedFaceCount: number;
  similarFaceCount: number;
}

export interface FolderFaceCountHistogram {
  oneFace: number;
  twoFaces: number;
  threeFaces: number;
  fourFaces: number;
  fiveOrMoreFaces: number;
}

export interface FolderFaceMainSubjectHistogram {
  oneMainSubject: number;
  twoMainSubjects: number;
  threeMainSubjects: number;
  fourMainSubjects: number;
  fiveOrMoreMainSubjects: number;
}

export interface FolderFaceSummary {
  folderPath: string;
  recursive: boolean;
  totalImages: number;
  faceAnalyzedImages: number;
  faceFailedImages: number;
  imagesWithFaces: number;
  detectedFaces: number;
  confirmedTaggedFaces: number;
  suggestedUntaggedFaces: number;
  taggedFaces: number;
  untaggedFaces: number;
  imagesWithDirectPersonTag: number;
  facesWithAgeGender: number;
  facesMissingAgeGender: number;
  childFaces: number;
  adultFaces: number;
  oneMainSubjectWithBackgroundFaces: number;
  faceCountHistogram: FolderFaceCountHistogram;
  mainSubjectHistogram: FolderFaceMainSubjectHistogram;
  topPersonTags: FolderFaceTopPersonTag[];
}

export interface FolderFaceSummaryReport {
  selectedWithSubfolders: FolderFaceSummary;
  selectedDirectOnly: FolderFaceSummary;
  subfolders: Array<{
    folderPath: string;
    name: string;
    summary: FolderFaceSummary;
  }>;
}

export interface FolderFaceSummaryStreamRowSpec {
  rowId: string;
  folderPath: string;
  name: string;
  recursive: boolean;
}

export interface FolderFaceSummaryStreamStart {
  folderPath: string;
  jobId: string;
  rows: FolderFaceSummaryStreamRowSpec[];
}

export type FolderFaceSummaryStreamEvent =
  | {
      kind: "row";
      jobId: string;
      rowId: string;
      summary: FolderFaceSummary;
      coverage: FolderAiCoverageReport;
    }
  | { kind: "done"; jobId: string }
  | { kind: "error"; jobId: string; message: string };

export type FolderAiSummaryStreamEvent =
  | { kind: "row"; jobId: string; rowId: string; coverage: FolderAiCoverageReport }
  | { kind: "done"; jobId: string }
  | { kind: "error"; jobId: string; message: string };

/** Row ids for `startFolderFaceSummaryStream` / face summary table (main + renderer). */
export const FOLDER_FACE_SUMMARY_STREAM_ROW_IDS = {
  selectedRecursive: "selectedRecursive",
  selectedDirect: "selectedDirect",
  singleFolder: "singleFolder",
} as const;

export const FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX = "subfolder:";

export function folderFaceSummarySubfolderRowId(folderPath: string): string {
  return `${FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX}${folderPath}`;
}

export interface FolderScanFreshness {
  lastMetadataScanCompletedAt: string | null;
  /** Oldest folder-level metadata scan under the tree; refined when `getFolderTreeScanSummary` completes (walked-tree MIN). */
  oldestFolderScanCompletedAt: string | null;
  oldestMetadataExtractedAt: string | null;
  lastMetadataExtractedAt: string | null;
  scannedCount: number;
  unscannedCount: number;
  totalMedia: number;
  /** Populated when `getFolderTreeScanSummary` runs quick scans; drives Folder tree scan card CTA. */
  folderTreeQuickScan: FolderTreeQuickScanResult | null;
}

export interface FolderAiSummaryOverview {
  folderPath: string;
  recursive: boolean;
  totalImages: number;
  totalVideos: number;
  scanFreshness: FolderScanFreshness;
}

export interface FolderAiSummaryOverviewReport {
  selectedWithSubfolders: FolderAiSummaryOverview;
  selectedDirectOnly: FolderAiSummaryOverview;
  hasDirectSubfolders: boolean;
  subfolders: Array<{
    folderPath: string;
    name: string;
    overview: FolderAiSummaryOverview;
  }>;
}

export interface FolderAiSummaryOverviewRequestOptions {
  includeSubfolders?: boolean;
  includeSubfolderOverviews?: boolean;
}

export interface FolderTreeScanSummary {
  hasDirectSubfolders: boolean;
  quickScan: FolderTreeQuickScanResult | null;
}

export type ImageRotationProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      total: number;
    }
  | {
      type: "progress";
      jobId: string;
      folderPath: string;
      processed: number;
      total: number;
      wronglyRotated: number;
      skipped: number;
      failed: number;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      processed: number;
      total: number;
      wronglyRotated: number;
      skipped: number;
      failed: number;
    }
  | {
      type: "job-cancelled";
      jobId: string;
      folderPath: string;
      processed: number;
      total: number;
      wronglyRotated: number;
      skipped: number;
      failed: number;
    }
  | {
      type: "job-failed";
      jobId: string;
      folderPath: string;
      error: string;
    };

export type ImageRotationProgressListener = (event: ImageRotationProgressEvent) => void;

export type FolderAiPipelineKind = "photo" | "face" | "semantic";

export interface FolderAiFailedFileItem {
  path: string;
  name: string;
  mediaKind: MediaKind;
  failedAt: string | null;
  error: string | null;
}

export interface FolderAiWronglyRotatedImagesPageRequest {
  folderPath: string;
  recursive: boolean;
  page: number;
  pageSize: number;
}

export interface FolderAiWronglyRotatedImageItem {
  id: string;
  sourcePath: string;
  name: string;
  imageUrl: string;
  folderPathRelative: string | null;
  rotationAngleClockwise: 90 | 180 | 270;
  cropRel: RelativeCropBox | null;
}

export interface FolderAiWronglyRotatedImagesPageResult {
  items: FolderAiWronglyRotatedImageItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PhotoAnalysisModelInfo {
  model: string;
  promptVersion: string;
  timestamp: string;
}

export interface PhotoAnalysisPerson {
  person_category?: "adult" | "child" | "baby" | null;
  gender?: "male" | "female" | "unknown" | "other" | null;
  average_age?: number | null;
}

export interface DocumentData {
  invoice_issuer?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  client_number?: string | null;
  invoice_total_amount?: number | null;
  invoice_total_amount_currency?: string | null;
  vat_percent?: number | null;
  vat_amount?: number | null;
}

export type PhotoEditType =
  | "rotate"
  | "crop"
  | "straighten"
  | "exposure_fix"
  | "contrast_fix"
  | "white_balance_fix"
  | "denoise"
  | "sharpen";

export interface RelativeCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoEditSuggestion {
  edit_type: PhotoEditType;
  priority?: "high" | "medium" | "low" | null;
  reason?: string | null;
  confidence?: number | null;
  auto_apply_safe?: boolean | null;
  rotation?: {
    observed_orientation?:
      | "upright"
      | "rotated_90_cw"
      | "rotated_180"
      | "rotated_270_cw"
      | "uncertain"
      | null;
    confidence_orientation?: number | null;
    angle_degrees_clockwise?: 90 | 180 | 270 | null;
  } | null;
  crop_rel?: RelativeCropBox | null;
  crop_target?: "document" | "subject" | "horizon_fix" | "other" | null;
  straighten?: {
    angle_degrees?: number | null;
  } | null;
  exposure_fix?: {
    ev_delta?: number | null;
  } | null;
  white_balance_fix?: {
    temperature_delta?: number | null;
    tint_delta?: number | null;
  } | null;
  contrast_fix?: {
    contrast_delta?: number | null;
  } | null;
  denoise?: {
    strength_0_1?: number | null;
  } | null;
  sharpen?: {
    strength_0_1?: number | null;
  } | null;
}

export interface PhotoAnalysisOutput {
  image_category: string;
  title: string;
  description: string;
  number_of_people?: number | null;
  has_children?: boolean | null;
  has_child_or_children?: boolean | null;
  people?: PhotoAnalysisPerson[];
  location?: string | null;
  date?: string | null;
  time?: string | null;
  weather?: string | null;
  daytime?: string | null;
  photo_estetic_quality?: number | null;
  is_low_quality?: boolean | null;
  quality_issues?: string[] | null;
  edit_suggestions?: PhotoEditSuggestion[] | null;
  document_data?: DocumentData | null;
  [key: string]: unknown;
  modelInfo: PhotoAnalysisModelInfo;
}

export type PhotoAnalysisItemStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export interface PhotoAnalysisItemState {
  path: string;
  name: string;
  status: PhotoAnalysisItemStatus;
  elapsedSeconds?: number;
  result?: PhotoAnalysisOutput;
  error?: string;
}

export interface AnalyzeFolderPhotosRequest {
  folderPath: string;
  model?: string;
  think?: boolean;
  timeoutMsPerImage?: number;
  /** When set, overrides saved settings for this run. */
  downscaleBeforeLlm?: boolean;
  /** When set, overrides saved settings for this run (longest edge, pixels). */
  downscaleLongestSidePx?: number;
  enableTwoPassRotationConsistency?: boolean;
  useFaceFeaturesForRotation?: boolean;
  extractInvoiceData?: boolean;
  mode?: "missing" | "all";
  /** Internal option: when true, exclude files that previously failed this pipeline. */
  skipPreviouslyFailed?: boolean;
  recursive?: boolean;
  concurrency?: number;
}

export interface AnalyzeFolderPhotosResult {
  jobId: string;
  total: number;
}

export type PhotoAnalysisProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      total: number;
      items: PhotoAnalysisItemState[];
    }
  | {
      type: "phase-updated";
      jobId: string;
      phase: "initializing-model" | "analyzing";
    }
  | {
      type: "item-updated";
      jobId: string;
      item: PhotoAnalysisItemState;
      currentFolderPath?: string;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      completed: number;
      failed: number;
      cancelled: number;
      averageSecondsPerFile: number;
    };

export type PhotoAnalysisProgressListener = (
  event: PhotoAnalysisProgressEvent,
) => void;

export type FaceSubjectRole = "main" | "background";

export interface FaceDetectionBox {
  bbox_xyxy: [number, number, number, number];
  score: number;
  landmarks_5: Array<[number, number]>;
  /** `shortSide(box) / max(shortSide(all boxes))`. Null when there are no other faces. */
  bboxShortSideRatioToLargest?: number | null;
  /** `box_area / image_area`, in [0,1]. */
  bboxAreaImageRatio?: number | null;
  /** Classification used by filters (e.g. "2 main subjects"). */
  subjectRole?: FaceSubjectRole;
  /**
   * Optional age/gender estimate from an auxiliary ONNX model.
   * Populated when the `faceAgeGenderDetection` toggle is enabled and the
   * model is available on disk.
   */
  ageGender?: FaceAgeGenderPrediction | null;
}

export interface FaceAgeGenderPrediction {
  /** Estimated age in years (0-100). */
  ageYears: number;
  /** "male" or "female" (case as stored). */
  gender: "male" | "female";
  /** Confidence in [0, 1] for the gender class. */
  genderConfidence: number;
  /** Identifier of the ONNX model that produced the estimate. */
  model: FaceAgeGenderModelId;
}

export type { CanonicalBoundingBox, FaceBeingBoundingBox, ProviderRawBoundingBoxReference };

export interface FaceDetectionModelInfo {
  service: string;
  modelName: string;
  modelPath?: string | null;
  timestamp: string;
}

export interface FaceDetectionOutput {
  faceCount: number;
  faces: FaceDetectionBox[];
  peopleBoundingBoxes: FaceBeingBoundingBox[];
  imageSizeForBoundingBoxes: { width: number; height: number } | null;
  modelInfo: FaceDetectionModelInfo;
}

export interface FaceDetectionServiceStatus {
  healthy: boolean;
  running: boolean;
  autoStarted: boolean;
  endpoint: string;
  modelName?: string | null;
  modelPath?: string | null;
  error?: string | null;
}

export type FaceDetectionItemStatus = PhotoAnalysisItemStatus;

export interface FaceDetectionItemState {
  path: string;
  name: string;
  status: FaceDetectionItemStatus;
  elapsedSeconds?: number;
  result?: FaceDetectionOutput;
  error?: string;
}

export interface DetectFolderFacesRequest {
  folderPath: string;
  mode?: "missing" | "all";
  /** Internal option: when true, exclude files that previously failed this pipeline. */
  skipPreviouslyFailed?: boolean;
  recursive?: boolean;
  concurrency?: number;
  faceDetectionSettings?: FaceDetectionSettings;
}

export interface DetectFolderFacesResult {
  jobId: string;
  total: number;
}

export type FaceDetectionProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      total: number;
      items: FaceDetectionItemState[];
    }
  | {
      type: "item-updated";
      jobId: string;
      item: FaceDetectionItemState;
      currentFolderPath?: string;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      completed: number;
      failed: number;
      cancelled: number;
      averageSecondsPerFile: number;
    };

export type FaceDetectionProgressListener = (
  event: FaceDetectionProgressEvent,
) => void;

export type MetadataScanItemStatus = "pending" | "running" | "success" | "failed" | "cancelled";
export type MetadataScanItemAction = "created" | "updated" | "unchanged" | "failed";

export interface MetadataScanItemState {
  path: string;
  name: string;
  status: MetadataScanItemStatus;
  action?: MetadataScanItemAction;
  mediaItemId?: string | null;
  error?: string;
}

export interface ScanFolderMetadataRequest {
  folderPath: string;
  recursive?: boolean;
}

export interface ScanFolderMetadataResult {
  jobId: string;
  total: number;
}

export type MetadataScanPhase = "preparing" | "scanning" | "geocoding" | "finalizing";

export type MetadataScanTriggerSource = "manual" | "auto";

export interface MetadataScanPathMove {
  previousPath: string;
  newPath: string;
}

export interface MetadataScanFilePathRef {
  path: string;
  name: string;
}

export interface MetadataScanFailedFileRef extends MetadataScanFilePathRef {
  error?: string;
}

export interface MetadataScanDeletedFileRef {
  id: string;
  sourcePath: string;
}

export type MetadataScanProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      recursive: boolean;
      triggerSource: MetadataScanTriggerSource;
      total: number;
      items: MetadataScanItemState[];
      /** Fixed for the whole job: 4 = preparing→scanning→geocoding→finalizing; 3 = no geocoding phase. */
      metadataUserPhaseCount: 3 | 4;
    }
  | {
      type: "phase-updated";
      jobId: string;
      phase: MetadataScanPhase;
      processed: number;
      total: number;
      gpsGeocodingEnabled?: boolean;
      geoDataUpdated?: number;
    }
  | {
      type: "item-updated";
      jobId: string;
      item: MetadataScanItemState;
      currentFolderPath?: string;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      recursive: boolean;
      triggerSource: MetadataScanTriggerSource;
      total: number;
      created: number;
      updated: number;
      unchanged: number;
      failed: number;
      cancelled: number;
      gpsGeocodingEnabled: boolean;
      geoDataUpdated: number;
      /** True when the user cancelled after some work; reconciliation may still have run if prepare finished. */
      scanCancelled: boolean;
      filesCreated: MetadataScanFilePathRef[];
      filesUpdated: MetadataScanFilePathRef[];
      filesFailed: MetadataScanFailedFileRef[];
      pathMoves: MetadataScanPathMove[];
      filesDeleted: MetadataScanDeletedFileRef[];
      /**
       * Files where AI should run or re-run: new catalog rows plus updates that
       * invalidated AI (not metadata-only catalog sync).
       */
      filesNeedingAiPipelineFollowUp: number;
      /** Per-folder catalog activity; `needsAiFollowUp` counts AI-invalidating / new rows only. */
      foldersTouched: Array<{
        folderPath: string;
        created: number;
        updated: number;
        needsAiFollowUp: number;
      }>;
    };

export type MetadataScanProgressListener = (event: MetadataScanProgressEvent) => void;

export type PathAnalysisProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      total: number;
    }
  | {
      type: "progress";
      jobId: string;
      processed: number;
      total: number;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      total: number;
      processed: number;
      failed: number;
    }
  | {
      type: "job-cancelled";
      jobId: string;
      folderPath: string;
    };

export type PathAnalysisProgressListener = (event: PathAnalysisProgressEvent) => void;

export type GeocoderInitStatus = "idle" | "downloading" | "loading-cache" | "parsing" | "ready" | "error";

export type GeocoderInitProgressEvent = {
  status: GeocoderInitStatus;
  error?: string;
  /** Download/indexing progress percent when available. */
  progressPercent?: number;
  /** Optional user-facing progress detail (e.g. downloaded datasets). */
  progressLabel?: string;
};

export interface GeocoderCacheStatus {
  hasLocalCopy: boolean;
}

export interface DesktopPersonTag {
  id: string;
  label: string;
  /** When true, shown first in people lists and as quick chips in AI image search. */
  pinned: boolean;
  /** ISO date-only `YYYY-MM-DD`, or null when unknown. */
  birthDate: string | null;
}

export interface DesktopPersonTagDeleteUsage {
  tagId: string;
  label: string;
  faceCount: number;
  mediaItemCount: number;
}

export type FaceEmbeddingStatus = "pending" | "indexing" | "ready" | "failed";

export interface DesktopFaceInstance {
  id: string;
  media_item_id: string;
  face_index: number;
  type: "auto";
  confidence: number | null;
  tag_id: string | null;
  tag: DesktopPersonTag | null;
  bounding_box: {
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
  };
  /** Same space as People thumbnails: detection / bbox_ref vs media_items. */
  ref_image_width: number | null;
  ref_image_height: number | null;
  landmarks_5: Array<[number, number]> | null;
  embedding_status: FaceEmbeddingStatus | null;
  cluster_id: string | null;
  crop_path: string | null;
  estimated_age_years: number | null;
  estimated_gender: string | null;
  age_gender_confidence: number | null;
  age_gender_model: string | null;
}

export interface EmbedFolderFacesRequest {
  folderPath: string;
  mode?: "missing" | "all";
  concurrency?: number;
}

export interface EmbedFolderFacesResult {
  jobId: string;
  total: number;
}

export type FaceEmbeddingItemStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface FaceEmbeddingItemState {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  status: FaceEmbeddingItemStatus;
  error?: string;
}

export type FaceEmbeddingProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      total: number;
    }
  | {
      type: "item-updated";
      jobId: string;
      faceInstanceId: string;
      status: FaceEmbeddingItemStatus;
      error?: string;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      embedded: number;
      failed: number;
      cancelled: number;
    };

export type FaceEmbeddingProgressListener = (event: FaceEmbeddingProgressEvent) => void;

export type FaceClusteringProgressPhase =
  | "loading"
  | "clustering"
  | "persisting"
  | "refreshing-suggestions";

export type FaceClusteringProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      totalFaces: number;
    }
  | {
      type: "progress";
      jobId: string;
      phase: FaceClusteringProgressPhase;
      processed: number;
      total: number;
    }
  | {
      type: "job-completed";
      jobId: string;
      clusterCount: number;
      suggestionsRefreshed?: number;
    }
  | {
      type: "job-failed";
      jobId: string;
      error: string;
    }
  | {
      type: "job-cancelled";
      jobId: string;
    };

export type FaceClusteringProgressListener = (event: FaceClusteringProgressEvent) => void;

export type SimilarUntaggedCountsProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      total: number;
      tagIds: string[];
    }
  | {
      type: "progress";
      jobId: string;
      processed: number;
      total: number;
      counts: Record<string, number>;
    }
  | { type: "job-completed"; jobId: string; counts: Record<string, number> }
  | { type: "job-failed"; jobId: string; error: string }
  | { type: "job-cancelled"; jobId: string };

export type SimilarUntaggedCountsProgressListener = (
  event: SimilarUntaggedCountsProgressEvent,
) => void;

// TEMPORARY: description embedding backfill — remove after migration
export type DescEmbedBackfillProgressEvent =
  | { type: "started"; jobId: string; total: number }
  | { type: "progress"; jobId: string; processed: number; total: number; indexed: number; skipped: number; failed: number }
  | { type: "completed"; jobId: string; indexed: number; skipped: number; failed: number }
  | { type: "failed"; jobId: string; error: string }
  | { type: "cancelled"; jobId: string };

export type DescEmbedBackfillProgressListener = (event: DescEmbedBackfillProgressEvent) => void;

export type SemanticIndexItemStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface SemanticIndexItemState {
  path: string;
  name: string;
  status: SemanticIndexItemStatus;
  elapsedSeconds?: number;
  error?: string;
}

export interface IndexFolderSemanticRequest {
  folderPath: string;
  mode?: "missing" | "all";
  /** Internal option: when true, exclude files that previously failed this pipeline. */
  skipPreviouslyFailed?: boolean;
  recursive?: boolean;
}

export interface IndexFolderSemanticResult {
  jobId: string;
  total: number;
}

export type SemanticIndexProgressEvent =
  | {
      type: "job-started";
      jobId: string;
      folderPath: string;
      total: number;
      items: SemanticIndexItemState[];
    }
  | {
      type: "phase-updated";
      jobId: string;
      phase: "indexing";
    }
  | {
      type: "item-updated";
      jobId: string;
      item: SemanticIndexItemState;
      currentFolderPath?: string;
    }
  | {
      type: "job-completed";
      jobId: string;
      folderPath: string;
      completed: number;
      failed: number;
      cancelled: number;
      averageSecondsPerFile: number;
      topFailureReasons?: Array<{ reason: string; count: number }>;
    };

export type SemanticIndexProgressListener = (event: SemanticIndexProgressEvent) => void;

export type FaceModelDownloadProgressEvent =
  | {
      type: "started";
      filename: string | null;
      message: string;
      startedAtIso: string;
    }
  | {
      type: "progress";
      filename: string;
      downloadedBytes: number;
      totalBytes: number | null;
      percent: number | null;
      message: string;
    }
  | {
      type: "completed";
      durationMs: number;
      message: string;
    }
  | {
      type: "failed";
      durationMs: number;
      error: string;
      message: string;
    };

export type FaceModelDownloadProgressListener = (
  event: FaceModelDownloadProgressEvent,
) => void;

export interface SimilarFaceSearchResult {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  tagId: string | null;
  tagLabel: string | null;
  score: number;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

/** Best matching existing person tag for an unassigned face (embedding similarity). */
export interface DesktopFacePersonTagSuggestion {
  tagId: string;
  tagLabel: string;
  score: number;
}

export interface DesktopPersonGroup {
  id: string;
  name: string;
}

/** Per untagged cluster: embedding member count vs centroid matches (same metric as findPersonMatches). */
export interface ClusterPersonCentroidMatchStats {
  memberCount: number;
  /** Cosine similarity >= threshold (high band). */
  matchingCount: number;
  /** lowThreshold <= similarity < threshold (10 percentage points below threshold, floored at 0). */
  midBandCount: number;
  /** Similarity < lowThreshold or unusable embedding. */
  belowMidCount: number;
}

export interface DesktopPersonTagWithFaceCount {
  id: string;
  label: string;
  pinned: boolean;
  /** ISO date-only `YYYY-MM-DD`, or null when unknown. */
  birthDate: string | null;
  taggedFaceCount: number;
  similarFaceCount: number;
}

export interface FaceClusterFaceInfo {
  faceInstanceId: string;
  sourcePath: string;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface FaceClusterInfo {
  clusterId: string;
  representativeFace: FaceClusterFaceInfo | null;
  memberCount: number;
  /** Loaded lazily per cluster via `listClusterFaceIds`; omitted on summary fetch. */
  faceIds?: string[];
}

export interface FaceClustersPageResult {
  clusters: FaceClusterInfo[];
  totalCount: number;
}

export interface FaceClusterTagSuggestion {
  tagId: string;
  tagLabel: string;
  score: number;
  sampleCount: number;
}

export interface TaggedFaceInfo {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  confidence: number | null;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface EmbeddingModelStatus {
  modelName: string | null;
  dimension: number | null;
  loaded: boolean;
}

export interface FaceEmbeddingStats {
  totalFaces: number;
  withEmbeddings: number;
  withLandmarks: number;
  pending: number;
}

export interface DesktopApi {
  selectLibraryFolder: () => Promise<string | null>;
  readFolderChildren: (folderPath: string) => Promise<FolderNode[]>;
  pruneFolderAnalysisForMissingChildren: (
    parentPath: string,
    existingChildren: string[],
  ) => Promise<{ removed: number }>;
  revealItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  listFolderImages: (folderPath: string) => Promise<MediaImageItem[]>;
  startFolderImagesStream: (request: string | FolderStreamRequest) => Promise<{ requestId: string }>;
  onFolderImagesProgress: (listener: FolderImagesProgressListener) => () => void;
  listFolderMedia: (folderPath: string) => Promise<MediaLibraryItem[]>;
  startFolderMediaStream: (request: string | FolderStreamRequest) => Promise<{ requestId: string }>;
  onFolderMediaProgress: (listener: FolderMediaProgressListener) => () => void;
  getSettings: () => Promise<AppSettings>;
  getDatabaseLocation: () => Promise<DatabaseLocationInfo>;
  getAiInferenceGpuOptions: () => Promise<AiInferenceGpuOption[]>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getFolderAnalysisStatuses: () => Promise<Record<string, FolderAnalysisStatus>>;
  getFolderAiSummaryOverview: (
    folderPath: string,
    options?: FolderAiSummaryOverviewRequestOptions,
  ) => Promise<FolderAiSummaryOverviewReport>;
  getFolderTreeScanSummary: (folderPath: string, outdatedAfterDays?: number) => Promise<FolderTreeScanSummary>;
  getFolderAiSummaryReport: (folderPath: string) => Promise<FolderAiSummaryReport>;
  getFolderFaceSummaryReport: (folderPath: string) => Promise<FolderFaceSummaryReport>;
  startFolderFaceSummaryStream: (
    folderPath: string,
    jobId: string,
  ) => Promise<FolderFaceSummaryStreamStart>;
  cancelFolderFaceSummaryStream: (jobId: string) => Promise<boolean>;
  onFolderFaceSummaryProgress: (
    listener: (payload: FolderFaceSummaryStreamEvent) => void,
  ) => () => void;
  startFolderAiSummaryStream: (
    folderPath: string,
    jobId: string,
  ) => Promise<FolderFaceSummaryStreamStart>;
  cancelFolderAiSummaryStream: (jobId: string) => Promise<boolean>;
  onFolderAiSummaryStreamProgress: (
    listener: (payload: FolderAiSummaryStreamEvent) => void,
  ) => () => void;
  getFolderAiFailedFiles: (
    folderPath: string,
    pipeline: FolderAiPipelineKind,
    recursive: boolean,
  ) => Promise<FolderAiFailedFileItem[]>;
  getFolderAiWronglyRotatedImages: (
    request: FolderAiWronglyRotatedImagesPageRequest,
  ) => Promise<FolderAiWronglyRotatedImagesPageResult>;
  getFolderAiCoverage: (folderPath: string, recursive: boolean) => Promise<FolderAiCoverageReport>;
  getFolderAiRollupsBatch: (folderPaths: string[]) => Promise<Record<string, FolderAiSidebarRollup>>;
  detectFolderImageRotation: (request: {
    folderPath: string;
    recursive?: boolean;
    mode?: "missing" | "all";
  }) => Promise<{ jobId: string; total: number }>;
  cancelImageRotationDetection: (jobId: string) => Promise<boolean>;
  onImageRotationProgress: (listener: ImageRotationProgressListener) => () => void;
  analyzeFolderPhotos: (
    request: AnalyzeFolderPhotosRequest,
  ) => Promise<AnalyzeFolderPhotosResult>;
  cancelPhotoAnalysis: (jobId: string) => Promise<boolean>;
  onPhotoAnalysisProgress: (
    listener: PhotoAnalysisProgressListener,
  ) => () => void;
  detectFolderFaces: (
    request: DetectFolderFacesRequest,
  ) => Promise<DetectFolderFacesResult>;
  cancelFaceDetection: (jobId: string) => Promise<boolean>;
  onFaceDetectionProgress: (
    listener: FaceDetectionProgressListener,
  ) => () => void;
  getFaceDetectionServiceStatus: () => Promise<FaceDetectionServiceStatus>;
  indexFolderSemanticEmbeddings: (request: IndexFolderSemanticRequest) => Promise<IndexFolderSemanticResult>;
  cancelSemanticEmbeddingIndex: (jobId: string) => Promise<boolean>;
  onSemanticIndexProgress: (listener: SemanticIndexProgressListener) => () => void;
  onFaceModelDownloadProgress: (
    listener: FaceModelDownloadProgressListener,
  ) => () => void;
  /**
   * Ensure the ONNX weights for the given face detector are present on disk.
   * Emits progress via `faceModelDownloadProgress`. Resolves when cached or downloaded.
   */
  ensureDetectorModel: (detectorModel: FaceDetectorModelId) => Promise<{
    success: boolean;
    alreadyPresent: boolean;
    error?: string;
  }>;
  /**
   * Ensure the ONNX weights for an auxiliary face-pipeline model (orientation classifier,
   * landmark refiner, or age/gender estimator) are present on disk.
   * Emits progress via `faceModelDownloadProgress`.
   */
  ensureAuxModel: (
    kind: AuxModelKind,
    modelId: AuxModelId,
  ) => Promise<{
    success: boolean;
    alreadyPresent: boolean;
    error?: string;
  }>;
  getSemanticEmbeddingStatus: () => Promise<{
    model: string;
    textEmbeddingReady: boolean;
    onnxTextEmbeddingReady: boolean;
    visionModelReady: boolean;
    visionOnnxReady: boolean;
    lastProbeError: string | null;
    vectorBackend: "classic" | "sqlite-vec";
    vectorBackendError: string | null;
    indexingInProgress: boolean;
    currentJobId: string | null;
    currentFolderPath: string | null;
  }>;
  getSemanticIndexDebugLogTail: () => Promise<{ path: string | null; content: string }>;
  semanticSearchPhotos: (request: {
    query: string;
    limit?: number;
    folderPath?: string;
    recursive?: boolean;
    personTagIds?: string[];
    includeUnconfirmedFaces?: boolean;
    /** ISO date string lower bound (e.g. catalog event / path extraction). */
    eventDateStart?: string;
    /** ISO date string upper bound. */
    eventDateEnd?: string;
    /** Case-insensitive substring match across country, city, area, place, location name. */
    locationQuery?: string;
    advancedSearch?: boolean;
    translateToEnglish?: boolean;
    queryAnalysisModel?: string;
    /** Grid visibility: min VLM cosine (`hideResultsBelowVlmSimilarity`). */
    vlmSimilarityThreshold?: number;
    /** Grid visibility: min AI-description cosine (`hideResultsBelowDescriptionSimilarity`). */
    descriptionSimilarityThreshold?: number;
    /** When true, run keyword-based re-ranking after RRF. See `AiImageSearchSettings.keywordMatchReranking`. */
    keywordMatchReranking?: boolean;
    /** Advanced search keyword hit floor for VLM embeddings. See `AiImageSearchSettings.keywordMatchThresholdVlm`. */
    keywordMatchThresholdVlm?: number;
    /** Advanced search keyword hit floor for AI description embeddings. */
    keywordMatchThresholdDescription?: number;
    /** Rank / fuse / gate by VLM + description (default), VLM only, or description only. */
    signalMode?: SemanticSearchSignalMode;
  }) => Promise<{
    results: Array<{
      mediaItemId: string;
      path: string;
      name: string;
      url: string;
      /** RRF fusion score (VLM + AI description ranks); unchanged when keyword re-rank runs (order only). */
      score: number;
      /** Cosine similarity vs image embedding; undefined if not in vision candidate set. */
      vlmSimilarity?: number;
      /** Cosine similarity vs AI text embedding; undefined if not in description candidate set. */
      descriptionSimilarity?: number;
      city: string | null;
      country: string | null;
      peopleDetected: number | null;
      ageMin: number | null;
      ageMax: number | null;
    }>;
    queryAnalysis?: {
      originalLanguage: string;
      translated: boolean;
      englishQuery: string;
      keywords: string[];
    };
  }>;
  scanFolderMetadata: (
    request: ScanFolderMetadataRequest,
  ) => Promise<ScanFolderMetadataResult>;
  cancelMetadataScan: (jobId: string) => Promise<boolean>;
  onMetadataScanProgress: (listener: MetadataScanProgressListener) => () => void;
  getMediaItemsByPaths: (paths: string[]) => Promise<Record<string, DesktopMediaItemMetadata>>;
  setMediaItemStarRating: (
    request: SetMediaItemStarRatingRequest,
  ) => Promise<SetMediaItemStarRatingResult>;
  listAlbums: (request?: AlbumListRequest) => Promise<AlbumListResult>;
  createAlbum: (title: string) => Promise<MediaAlbumSummary>;
  updateAlbumTitle: (albumId: string, title: string) => Promise<MediaAlbumSummary>;
  deleteAlbum: (albumId: string) => Promise<void>;
  listAlbumItems: (request: AlbumItemsRequest) => Promise<AlbumItemsResult>;
  listAlbumsForMediaItem: (mediaItemIdOrPath: string) => Promise<AlbumMembership[]>;
  addMediaItemsToAlbum: (albumId: string, mediaItemIds: string[]) => Promise<void>;
  removeMediaItemFromAlbum: (albumId: string, mediaItemId: string) => Promise<void>;
  setAlbumCover: (albumId: string, mediaItemId: string | null) => Promise<void>;
  listSmartAlbumPlaces: (request: SmartAlbumPlacesRequest) => Promise<SmartAlbumPlacesResult>;
  listSmartAlbumYears: (request?: SmartAlbumYearsRequest) => Promise<SmartAlbumYearsResult>;
  listSmartAlbumItems: (request: SmartAlbumItemsRequest) => Promise<AlbumItemsResult>;
  onMediaItemMetadataRefreshed: (
    listener: (byPath: Record<string, DesktopMediaItemMetadata>) => void,
  ) => () => void;
  listPersonTags: () => Promise<DesktopPersonTag[]>;
  listPersonTagsWithFaceCounts: () => Promise<DesktopPersonTagWithFaceCount[]>;
  listPersonGroups: () => Promise<DesktopPersonGroup[]>;
  createPersonGroup: (name: string) => Promise<DesktopPersonGroup>;
  setPersonTagGroups: (tagId: string, groupIds: string[]) => Promise<void>;
  getPersonTagGroupsForTagIds: (
    tagIds: string[],
  ) => Promise<Record<string, DesktopPersonGroup[]>>;
  updatePersonGroupName: (groupId: string, name: string) => Promise<DesktopPersonGroup>;
  deletePersonGroup: (groupId: string) => Promise<void>;
  listPersonTagsInGroup: (groupId: string) => Promise<DesktopPersonTag[]>;
  getClusterPersonMatchStatsBatch: (
    items: Array<{ clusterId: string; tagId: string }>,
    threshold?: number,
  ) => Promise<Record<string, ClusterPersonCentroidMatchStats>>;
  getClusterMemberFaceIdsForPersonSimilarityFilter: (
    clusterId: string,
    tagId: string,
    mode: "matching" | "mid" | "below",
    threshold?: number,
  ) => Promise<string[]>;
  getSimilarUntaggedFaceCountsForTags: (
    tagIds: string[],
    threshold?: number,
  ) => Promise<Record<string, number>>;
  startSimilarUntaggedFaceCountsJob: (request: {
    tagIds: string[];
    threshold?: number;
  }) => Promise<{ jobId: string }>;
  cancelSimilarUntaggedFaceCountsJob: (jobId: string) => Promise<boolean>;
  onSimilarUntaggedCountsProgress: (
    listener: SimilarUntaggedCountsProgressListener,
  ) => () => void;
  createPersonTag: (label: string, birthDate?: string | null) => Promise<DesktopPersonTag>;
  updatePersonTagLabel: (tagId: string, label: string) => Promise<DesktopPersonTag>;
  updatePersonTagBirthDate: (tagId: string, birthDate: string | null) => Promise<DesktopPersonTag>;
  getPersonTagDeleteUsage: (tagId: string) => Promise<DesktopPersonTagDeleteUsage>;
  deletePersonTag: (tagId: string) => Promise<boolean>;
  setPersonTagPinned: (tagId: string, pinned: boolean) => Promise<DesktopPersonTag>;
  listFaceInstancesForMediaItem: (mediaItemId: string) => Promise<DesktopFaceInstance[]>;
  assignPersonTagToFace: (faceInstanceId: string, tagId: string) => Promise<DesktopFaceInstance | null>;
  assignPersonTagsToFaces: (
    faceInstanceIds: string[],
    tagId: string,
  ) => Promise<{ assignedCount: number }>;
  refreshPersonSuggestionsForTag: (tagId: string) => Promise<{ count: number }>;
  recomputePersonCentroid: (
    tagId: string,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  clearPersonTagFromFace: (faceInstanceId: string) => Promise<DesktopFaceInstance | null>;
  deleteFaceInstance: (faceInstanceId: string) => Promise<boolean>;
  detectFacesForMediaItem: (
    sourcePath: string,
    faceDetectionSettings?: FaceDetectionSettings,
  ) => Promise<{ success: boolean; faceCount: number }>;
  embedFolderFaces: (
    request: EmbedFolderFacesRequest,
  ) => Promise<EmbedFolderFacesResult>;
  cancelFaceEmbedding: (jobId: string) => Promise<boolean>;
  onFaceEmbeddingProgress: (listener: FaceEmbeddingProgressListener) => () => void;
  getEmbeddingModelStatus: () => Promise<EmbeddingModelStatus>;
  getEmbeddingStats: () => Promise<FaceEmbeddingStats>;
  searchSimilarFaces: (request: {
    faceInstanceId: string;
    threshold?: number;
    limit?: number;
    /** When true, only compare against faces that already have a person tag. */
    taggedOnly?: boolean;
  }) => Promise<SimilarFaceSearchResult[]>;
  suggestPersonTagForFace: (request: {
    faceInstanceId: string;
    threshold?: number;
  }) => Promise<DesktopFacePersonTagSuggestion | null>;
  findPersonMatches: (request: {
    tagId: string;
    threshold?: number;
    limit?: number;
  }) => Promise<SimilarFaceSearchResult[]>;
  getFaceClusters: (request?: {
    offset?: number;
    limit?: number;
  }) => Promise<FaceClustersPageResult>;
  listClusterFaceIds: (
    clusterId: string,
    options?: { offset?: number; limit?: number },
  ) => Promise<string[]>;
  runFaceClustering: (options?: {
    similarityThreshold?: number;
    minClusterSize?: number;
  }) => Promise<{ jobId: string }>;
  cancelFaceClustering: (jobId: string) => Promise<boolean>;
  onFaceClusteringProgress: (listener: FaceClusteringProgressListener) => () => void;
  assignClusterToPerson: (
    clusterId: string,
    tagId: string,
  ) => Promise<{ assignedCount: number }>;
  suggestPersonTagForCluster: (
    clusterId: string,
    threshold?: number,
  ) => Promise<FaceClusterTagSuggestion | null>;
  suggestPersonTagsForClusters: (
    clusterIds: string[],
    threshold?: number,
  ) => Promise<Record<string, FaceClusterTagSuggestion | null>>;
  getFaceCropPaths: (
    faceInstanceIds: string[],
  ) => Promise<Record<string, string | null>>;
  getFaceInfoByIds: (
    faceInstanceIds: string[],
  ) => Promise<Record<string, FaceClusterFaceInfo | null>>;
  getFaceToPersonCentroidSimilarities: (
    faceInstanceIds: string[],
    tagId: string,
  ) => Promise<Record<string, number>>;
  refreshPersonSuggestions: () => Promise<{ count: number }>;
  listFacesForPerson: (
    tagId: string,
  ) => Promise<TaggedFaceInfo[]>;
  reprocessFaceCropsAndEmbeddings: () => Promise<{
    totalCropsNeeded: number;
    totalEmbeddingsNeeded: number;
  }>;
  purgeDeletedMediaItems: () => Promise<{
    purgedMediaItems: number;
    purgedFaceInstances: number;
    purgedEmbeddings: number;
    purgedAlbumItems: number;
    purgedItemTags: number;
    purgedFsObjects: number;
    purgedSources: number;
  }>;
  purgeSoftDeletedMediaItemsByIds: (mediaItemIds: string[]) => Promise<{
    purgedMediaItems: number;
    purgedFaceInstances: number;
    purgedEmbeddings: number;
    purgedAlbumItems: number;
    purgedItemTags: number;
    purgedFsObjects: number;
    purgedSources: number;
  }>;
  analyzeFolderPathMetadata: (request: {
    folderPath: string;
    recursive?: boolean;
    model?: string;
  }) => Promise<{ jobId: string; total: number }>;
  cancelPathAnalysis: (jobId: string) => Promise<boolean>;
  onPathAnalysisProgress: (listener: PathAnalysisProgressListener) => () => void;
  getGeocoderCacheStatus: () => Promise<GeocoderCacheStatus>;
  initGeocoder: (options?: { forceRefresh?: boolean }) => Promise<void>;
  onGeocoderInitProgress: (listener: (event: GeocoderInitProgressEvent) => void) => () => void;
  // TEMPORARY: description embedding backfill — remove after migration
  indexDescriptionEmbeddings: (request: {
    folderPath: string;
    recursive: boolean;
  }) => Promise<{ jobId: string }>;
  cancelDescEmbedBackfill: (jobId: string) => Promise<boolean>;
  onDescEmbedBackfillProgress: (listener: DescEmbedBackfillProgressListener) => () => void;
  /**
   * Central pipeline orchestration surface. See `pipeline-ipc.ts` for the
   * type details. Phase 1 onwards: enqueue / cancel / observe bundled and
   * standalone pipelines through a single FIFO scheduler.
   */
  pipelines: PipelineDesktopApi;
  _logToMain: (msg: string) => void;
}
