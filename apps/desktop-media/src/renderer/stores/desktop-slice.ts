import type { StateCreator } from "zustand";
import {
  type AiInferenceGpuOption,
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  DEFAULT_FACE_DETECTION_SETTINGS,
  DEFAULT_FOLDER_SCANNING_SETTINGS,
  DEFAULT_MEDIA_VIEWER_SETTINGS,
  DEFAULT_PATH_EXTRACTION_SETTINGS,
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  DEFAULT_SMART_ALBUM_SETTINGS,
  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS,
  type AiImageSearchSettings,
  type FaceDetectionSettings,
  type FolderAiSidebarRollup,
  type FolderAnalysisStatus,
  type FolderNode,
  type FolderScanningSettings,
  type MediaViewerSettings,
  type GeocoderInitStatus,
  type PathExtractionSettings,
  type PhotoAnalysisSettings,
  type SmartAlbumSettings,
  type MetadataManualScanResultPayload,
  type WrongImageRotationDetectionSettings,
} from "../../shared/ipc";

export interface MetadataScanCompletionSignal {
  jobId: string;
  folderPath: string;
  recursive: boolean;
  completedAt: string;
  changed: boolean;
  foldersTouched: string[];
}

export interface AiPipelineCompletionSignal {
  jobId: string;
  folderPath: string;
  kind: "photo" | "face" | "semantic" | "rotation";
  completedAt: string;
}

export interface DesktopSlice {
  clientId: string;
  libraryRoots: string[];
  hideAdvancedSettings: boolean;
  expandedFolders: Set<string>;
  selectedFolder: string | null;
  childrenByPath: Record<string, FolderNode[]>;
  folderAnalysisByPath: Record<string, FolderAnalysisStatus>;
  /** Subtree AI rollup per folder path (sidebar icons). */
  folderRollupByPath: Record<string, FolderAiSidebarRollup>;
  /** After metadata scan, prompt when new or AI-invalidated files need pipeline runs. */
  metadataScanFollowUp: null | {
    scanRootFolderPath: string;
    filesNeedingAiPipelineFollowUp: number;
    foldersNeedingAiFollowUpCount: number;
  };

  /** Manual “Scan for file changes” only: detailed per-group file lists after the job. */
  metadataManualScanResult: MetadataManualScanResultPayload | null;
  lastMetadataScanCompletion: MetadataScanCompletionSignal | null;
  lastAiPipelineCompletion: AiPipelineCompletionSignal | null;

  isFolderLoading: boolean;
  faceDetectionSettings: FaceDetectionSettings;
  wrongImageRotationDetectionSettings: WrongImageRotationDetectionSettings;
  photoAnalysisSettings: PhotoAnalysisSettings;
  folderScanningSettings: FolderScanningSettings;
  smartAlbumSettings: SmartAlbumSettings;
  aiImageSearchSettings: AiImageSearchSettings;
  mediaViewerSettings: MediaViewerSettings;
  pathExtractionSettings: PathExtractionSettings;
  aiInferencePreferredGpuId: string | null;
  aiInferenceGpuOptions: AiInferenceGpuOption[];
  faceModelDownload: {
    visible: boolean;
    message: string;
    filename: string | null;
    percent: number | null;
    downloadedBytes: number | null;
    totalBytes: number | null;
    status: "idle" | "running" | "completed" | "failed";
    error: string | null;
    durationMs: number | null;
  };

  /** LLM path metadata extraction (folder menu). */
  pathAnalysisJobId: string | null;
  pathAnalysisStatus: "idle" | "running";
  pathAnalysisProcessed: number;
  pathAnalysisTotal: number;
  pathAnalysisFolderPath: string | null;
  pathAnalysisPanelVisible: boolean;
  pathAnalysisError: string | null;

  imageRotationJobId: string | null;
  imageRotationStatus: "idle" | "running" | "completed" | "cancelled" | "failed";
  imageRotationProcessed: number;
  imageRotationTotal: number;
  imageRotationWronglyRotated: number;
  imageRotationSkipped: number;
  imageRotationFailed: number;
  imageRotationFolderPath: string | null;
  imageRotationError: string | null;
  imageRotationPanelVisible: boolean;

  geocoderInitStatus: GeocoderInitStatus;
  geocoderInitError: string | null;
  geocoderInitPanelVisible: boolean;

  /** Background job: live similar-untyped face counts for People list (paginated tags). */
  similarUntaggedCountsJobId: string | null;
  similarUntaggedCountsStatus: "idle" | "running" | "completed" | "cancelled" | "failed";
  similarUntaggedCountsProcessed: number;
  similarUntaggedCountsTotal: number;
  similarUntaggedCountsByTagId: Record<string, number>;
  similarUntaggedCountsError: string | null;
  similarUntaggedCountsPanelVisible: boolean;

  setLibraryRoots: (roots: string[]) => void;
  setHideAdvancedSettings: (hide: boolean) => void;
  addLibraryRoot: (root: string) => void;
  removeLibraryRoot: (root: string) => void;
  setExpandedFolders: (folders: Set<string>) => void;
  toggleFolderExpand: (path: string) => void;
  selectFolder: (path: string | null) => void;
  setChildrenByPath: (path: string, children: FolderNode[]) => void;
  setFolderAnalysisByPath: (statuses: Record<string, FolderAnalysisStatus>) => void;
  updateFolderAnalysis: (path: string, status: FolderAnalysisStatus) => void;
  setMetadataScanFollowUp: (payload: {
    scanRootFolderPath: string;
    filesNeedingAiPipelineFollowUp: number;
    foldersNeedingAiFollowUpCount: number;
  }) => void;
  clearMetadataScanFollowUp: () => void;
  setMetadataManualScanResult: (payload: MetadataManualScanResultPayload | null) => void;
  setLastMetadataScanCompletion: (payload: MetadataScanCompletionSignal) => void;
  setLastAiPipelineCompletion: (payload: AiPipelineCompletionSignal) => void;
  setFolderLoading: (loading: boolean) => void;
  setFaceDetectionSettings: (settings: FaceDetectionSettings) => void;
  setWrongImageRotationDetectionSettings: (settings: WrongImageRotationDetectionSettings) => void;
  updateWrongImageRotationDetectionSetting: <K extends keyof WrongImageRotationDetectionSettings>(
    key: K,
    value: WrongImageRotationDetectionSettings[K],
  ) => void;
  updateFaceDetectionSetting: <K extends keyof FaceDetectionSettings>(
    key: K,
    value: FaceDetectionSettings[K],
  ) => void;
  resetFaceDetectionOnlySettings: () => void;
  resetFaceRecognitionOnlySettings: () => void;
  setPhotoAnalysisSettings: (settings: PhotoAnalysisSettings) => void;
  updatePhotoAnalysisSetting: <K extends keyof PhotoAnalysisSettings>(
    key: K,
    value: PhotoAnalysisSettings[K],
  ) => void;
  resetPhotoAnalysisSettings: () => void;
  setFolderScanningSettings: (settings: FolderScanningSettings) => void;
  updateFolderScanningSetting: <K extends keyof FolderScanningSettings>(
    key: K,
    value: FolderScanningSettings[K],
  ) => void;
  resetFolderScanningSettings: () => void;
  setSmartAlbumSettings: (settings: SmartAlbumSettings) => void;
  updateSmartAlbumSetting: <K extends keyof SmartAlbumSettings>(
    key: K,
    value: SmartAlbumSettings[K],
  ) => void;
  resetSmartAlbumSettings: () => void;
  setAiImageSearchSettings: (settings: AiImageSearchSettings) => void;
  updateAiImageSearchSetting: <K extends keyof AiImageSearchSettings>(
    key: K,
    value: AiImageSearchSettings[K],
  ) => void;
  resetAiImageSearchSettings: () => void;
  setMediaViewerSettings: (settings: MediaViewerSettings) => void;
  updateMediaViewerSetting: <K extends keyof MediaViewerSettings>(
    key: K,
    value: MediaViewerSettings[K],
  ) => void;
  resetMediaViewerSettings: () => void;
  setPathExtractionSettings: (settings: PathExtractionSettings) => void;
  updatePathExtractionSetting: <K extends keyof PathExtractionSettings>(
    key: K,
    value: PathExtractionSettings[K],
  ) => void;
  resetPathExtractionSettings: () => void;
  setAiInferencePreferredGpuId: (gpuId: string | null) => void;
  setAiInferenceGpuOptions: (options: AiInferenceGpuOption[]) => void;

  setGeocoderInitStatus: (status: GeocoderInitStatus, error?: string) => void;
  setGeocoderInitPanelVisible: (visible: boolean) => void;
  setImageRotationPanelVisible: (visible: boolean) => void;

  resetSimilarUntaggedCountsJob: () => void;
  setSimilarUntaggedCountsPanelVisible: (visible: boolean) => void;
}

export const createDesktopSlice: StateCreator<DesktopSlice, [["zustand/immer", never]]> = (set) => ({
  clientId: "",
  libraryRoots: [],
  hideAdvancedSettings: true,
  expandedFolders: new Set<string>(),
  selectedFolder: null,
  childrenByPath: {},
  folderAnalysisByPath: {},
  folderRollupByPath: {},
  metadataScanFollowUp: null,
  metadataManualScanResult: null,
  lastMetadataScanCompletion: null,
  lastAiPipelineCompletion: null,
  isFolderLoading: false,
  faceDetectionSettings: { ...DEFAULT_FACE_DETECTION_SETTINGS },
  wrongImageRotationDetectionSettings: { ...DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS },
  photoAnalysisSettings: { ...DEFAULT_PHOTO_ANALYSIS_SETTINGS },
  folderScanningSettings: { ...DEFAULT_FOLDER_SCANNING_SETTINGS },
  smartAlbumSettings: { ...DEFAULT_SMART_ALBUM_SETTINGS },
  aiImageSearchSettings: { ...DEFAULT_AI_IMAGE_SEARCH_SETTINGS },
  mediaViewerSettings: { ...DEFAULT_MEDIA_VIEWER_SETTINGS },
  pathExtractionSettings: { ...DEFAULT_PATH_EXTRACTION_SETTINGS },
  aiInferencePreferredGpuId: null,
  aiInferenceGpuOptions: [],
  faceModelDownload: {
    visible: false,
    message: "",
    filename: null,
    percent: null,
    downloadedBytes: null,
    totalBytes: null,
    status: "idle",
    error: null,
    durationMs: null,
  },

  pathAnalysisJobId: null,
  pathAnalysisStatus: "idle",
  pathAnalysisProcessed: 0,
  pathAnalysisTotal: 0,
  pathAnalysisFolderPath: null,
  pathAnalysisPanelVisible: false,
  pathAnalysisError: null,

  imageRotationJobId: null,
  imageRotationStatus: "idle",
  imageRotationProcessed: 0,
  imageRotationTotal: 0,
  imageRotationWronglyRotated: 0,
  imageRotationSkipped: 0,
  imageRotationFailed: 0,
  imageRotationFolderPath: null,
  imageRotationError: null,
  imageRotationPanelVisible: false,

  geocoderInitStatus: "idle",
  geocoderInitError: null,
  geocoderInitPanelVisible: false,

  similarUntaggedCountsJobId: null,
  similarUntaggedCountsStatus: "idle",
  similarUntaggedCountsProcessed: 0,
  similarUntaggedCountsTotal: 0,
  similarUntaggedCountsByTagId: {},
  similarUntaggedCountsError: null,
  similarUntaggedCountsPanelVisible: false,

  setLibraryRoots: (roots) =>
    set((state) => {
      state.libraryRoots = roots;
    }),

  setHideAdvancedSettings: (hide) =>
    set((state) => {
      state.hideAdvancedSettings = hide;
    }),

  addLibraryRoot: (root) =>
    set((state) => {
      if (!state.libraryRoots.includes(root)) {
        state.libraryRoots.push(root);
      }
    }),

  removeLibraryRoot: (root) =>
    set((state) => {
      state.libraryRoots = state.libraryRoots.filter((libraryRoot) => libraryRoot !== root);
    }),

  setExpandedFolders: (folders) =>
    set((state) => {
      state.expandedFolders = folders;
    }),

  toggleFolderExpand: (path) =>
    set((state) => {
      if (state.expandedFolders.has(path)) {
        state.expandedFolders.delete(path);
      } else {
        state.expandedFolders.add(path);
      }
    }),

  selectFolder: (path) =>
    set((state) => {
      state.selectedFolder = path;
    }),

  setChildrenByPath: (path, children) =>
    set((state) => {
      state.childrenByPath[path] = children;
    }),

  setFolderAnalysisByPath: (statuses) =>
    set((state) => {
      state.folderAnalysisByPath = statuses;
    }),

  updateFolderAnalysis: (path, status) =>
    set((state) => {
      state.folderAnalysisByPath[path] = status;
    }),

  setMetadataScanFollowUp: (payload) =>
    set((state) => {
      state.metadataScanFollowUp = payload;
    }),

  clearMetadataScanFollowUp: () =>
    set((state) => {
      state.metadataScanFollowUp = null;
    }),

  setMetadataManualScanResult: (payload) =>
    set((state) => {
      state.metadataManualScanResult = payload;
    }),

  setLastMetadataScanCompletion: (payload) =>
    set((state) => {
      state.lastMetadataScanCompletion = payload;
    }),

  setLastAiPipelineCompletion: (payload) =>
    set((state) => {
      state.lastAiPipelineCompletion = payload;
    }),

  setFolderLoading: (loading) =>
    set((state) => {
      state.isFolderLoading = loading;
    }),

  setFaceDetectionSettings: (settings) =>
    set((state) => {
      state.faceDetectionSettings = settings;
    }),

  setWrongImageRotationDetectionSettings: (settings) =>
    set((state) => {
      state.wrongImageRotationDetectionSettings = settings;
    }),

  updateWrongImageRotationDetectionSetting: (key, value) =>
    set((state) => {
      state.wrongImageRotationDetectionSettings[key] = value;
    }),

  updateFaceDetectionSetting: (key, value) =>
    set((state) => {
      state.faceDetectionSettings[key] = value;
    }),

  resetFaceDetectionOnlySettings: () =>
    set((state) => {
      state.faceDetectionSettings.detectorModel =
        DEFAULT_FACE_DETECTION_SETTINGS.detectorModel;
      state.faceDetectionSettings.minConfidenceThreshold =
        DEFAULT_FACE_DETECTION_SETTINGS.minConfidenceThreshold;
      state.faceDetectionSettings.minFaceBoxShortSideRatio =
        DEFAULT_FACE_DETECTION_SETTINGS.minFaceBoxShortSideRatio;
      state.faceDetectionSettings.faceBoxOverlapMergeRatio =
        DEFAULT_FACE_DETECTION_SETTINGS.faceBoxOverlapMergeRatio;
      state.faceDetectionSettings.mainSubjectMinSizeRatioToLargest =
        DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinSizeRatioToLargest;
      state.faceDetectionSettings.mainSubjectMinImageAreaRatio =
        DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinImageAreaRatio;
      state.faceDetectionSettings.preserveTaggedFacesMinIoU =
        DEFAULT_FACE_DETECTION_SETTINGS.preserveTaggedFacesMinIoU;
      state.faceDetectionSettings.keepUnmatchedTaggedFaces =
        DEFAULT_FACE_DETECTION_SETTINGS.keepUnmatchedTaggedFaces;
      state.faceDetectionSettings.imageOrientationDetection = {
        ...DEFAULT_FACE_DETECTION_SETTINGS.imageOrientationDetection,
      };
      state.faceDetectionSettings.faceLandmarkRefinement = {
        ...DEFAULT_FACE_DETECTION_SETTINGS.faceLandmarkRefinement,
      };
      state.faceDetectionSettings.faceAgeGenderDetection = {
        ...DEFAULT_FACE_DETECTION_SETTINGS.faceAgeGenderDetection,
      };
    }),

  resetFaceRecognitionOnlySettings: () =>
    set((state) => {
      state.faceDetectionSettings.faceRecognitionSimilarityThreshold =
        DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold;
      state.faceDetectionSettings.faceGroupPairwiseSimilarityThreshold =
        DEFAULT_FACE_DETECTION_SETTINGS.faceGroupPairwiseSimilarityThreshold;
      state.faceDetectionSettings.faceGroupMinSize =
        DEFAULT_FACE_DETECTION_SETTINGS.faceGroupMinSize;
    }),

  setPhotoAnalysisSettings: (settings) =>
    set((state) => {
      state.photoAnalysisSettings = settings;
    }),

  updatePhotoAnalysisSetting: (key, value) =>
    set((state) => {
      state.photoAnalysisSettings[key] = value;
    }),

  resetPhotoAnalysisSettings: () =>
    set((state) => {
      state.photoAnalysisSettings = { ...DEFAULT_PHOTO_ANALYSIS_SETTINGS };
    }),

  setFolderScanningSettings: (settings) =>
    set((state) => {
      state.folderScanningSettings = settings;
    }),

  updateFolderScanningSetting: (key, value) =>
    set((state) => {
      state.folderScanningSettings[key] = value;
    }),

  resetFolderScanningSettings: () =>
    set((state) => {
      state.folderScanningSettings = { ...DEFAULT_FOLDER_SCANNING_SETTINGS };
    }),

  setSmartAlbumSettings: (settings) =>
    set((state) => {
      state.smartAlbumSettings = settings;
    }),

  updateSmartAlbumSetting: (key, value) =>
    set((state) => {
      state.smartAlbumSettings[key] = value;
    }),

  resetSmartAlbumSettings: () =>
    set((state) => {
      state.smartAlbumSettings = { ...DEFAULT_SMART_ALBUM_SETTINGS };
    }),

  setAiImageSearchSettings: (settings) =>
    set((state) => {
      state.aiImageSearchSettings = settings;
    }),

  updateAiImageSearchSetting: (key, value) =>
    set((state) => {
      state.aiImageSearchSettings[key] = value;
    }),

  resetAiImageSearchSettings: () =>
    set((state) => {
      state.aiImageSearchSettings = { ...DEFAULT_AI_IMAGE_SEARCH_SETTINGS };
    }),

  setMediaViewerSettings: (settings) =>
    set((state) => {
      state.mediaViewerSettings = settings;
    }),

  updateMediaViewerSetting: (key, value) =>
    set((state) => {
      state.mediaViewerSettings[key] = value;
    }),

  resetMediaViewerSettings: () =>
    set((state) => {
      state.mediaViewerSettings = { ...DEFAULT_MEDIA_VIEWER_SETTINGS };
    }),

  setPathExtractionSettings: (settings) =>
    set((state) => {
      state.pathExtractionSettings = settings;
    }),

  updatePathExtractionSetting: (key, value) =>
    set((state) => {
      state.pathExtractionSettings[key] = value;
    }),

  resetPathExtractionSettings: () =>
    set((state) => {
      state.pathExtractionSettings = { ...DEFAULT_PATH_EXTRACTION_SETTINGS };
    }),
  setAiInferencePreferredGpuId: (gpuId) =>
    set((state) => {
      state.aiInferencePreferredGpuId = gpuId;
    }),
  setAiInferenceGpuOptions: (options) =>
    set((state) => {
      state.aiInferenceGpuOptions = options;
    }),

  resetSimilarUntaggedCountsJob: () =>
    set((state) => {
      state.similarUntaggedCountsJobId = null;
      state.similarUntaggedCountsStatus = "idle";
      state.similarUntaggedCountsProcessed = 0;
      state.similarUntaggedCountsTotal = 0;
      state.similarUntaggedCountsError = null;
    }),

  setSimilarUntaggedCountsPanelVisible: (visible) =>
    set((state) => {
      state.similarUntaggedCountsPanelVisible = visible;
    }),

  setGeocoderInitStatus: (status, error) =>
    set((state) => {
      state.geocoderInitStatus = status;
      state.geocoderInitError = error ?? null;
      if (status === "downloading" || status === "loading-cache" || status === "parsing") {
        state.geocoderInitPanelVisible = true;
      }
    }),

  setGeocoderInitPanelVisible: (visible) =>
    set((state) => {
      state.geocoderInitPanelVisible = visible;
    }),

  setImageRotationPanelVisible: (visible) =>
    set((state) => {
      state.imageRotationPanelVisible = visible;
    }),
});
