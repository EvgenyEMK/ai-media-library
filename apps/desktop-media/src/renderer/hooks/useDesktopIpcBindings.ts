import { useEffect, useRef } from "react";
import { DEFAULT_PHOTO_ANALYSIS_SETTINGS } from "../../shared/ipc";
import { useDesktopStoreApi } from "../stores/desktop-store";
import {
  bindPhotoAnalysisProgress,
  bindFaceDetectionProgress,
  bindFaceClusteringProgress,
  bindGeocoderInitProgress,
  bindSimilarUntaggedCountsProgress,
  bindMetadataScanProgress,
  bindSemanticIndexProgress,
  bindPathAnalysisProgress,
  bindImageRotationProgress,
} from "./ipc-progress-binders";
import {
  clearPendingRefreshTimers,
  refreshFolderAiRollups,
  refreshFolderAnalysisStatuses,
} from "./ipc-binding-helpers";

export function useDesktopIpcBindings(): void {
  const store = useDesktopStoreApi();

  useEffect(() => {
    const cleanupAnalysis = bindPhotoAnalysisProgress(store);
    const cleanupFace = bindFaceDetectionProgress(store);
    const cleanupFaceClustering = bindFaceClusteringProgress(store);
    const cleanupSimilarUntaggedCounts = bindSimilarUntaggedCountsProgress(store);
    const cleanupMetadata = bindMetadataScanProgress(store);
    const cleanupSemantic = bindSemanticIndexProgress(store);
    const cleanupPathAnalysis = bindPathAnalysisProgress(store);
    const cleanupImageRotation = bindImageRotationProgress(store);
    const cleanupGeocoder = bindGeocoderInitProgress(store);
    const cleanupMetadataRefreshed = window.desktopApi.onMediaItemMetadataRefreshed((byPath) => {
      store.setState((s) => {
        s.mediaMetadataByItemId = { ...s.mediaMetadataByItemId, ...byPath };
      });
    });
    const cleanupFaceModelDownload = window.desktopApi.onFaceModelDownloadProgress((event) => {
      store.setState((s) => {
        if (event.type === "started") {
          s.faceModelDownload.visible = true;
          s.faceModelDownload.status = "running";
          s.faceModelDownload.message = event.message;
          s.faceModelDownload.filename = event.filename;
          s.faceModelDownload.percent = null;
          s.faceModelDownload.downloadedBytes = null;
          s.faceModelDownload.totalBytes = null;
          s.faceModelDownload.error = null;
          s.faceModelDownload.durationMs = null;
          return;
        }
        if (event.type === "progress") {
          s.faceModelDownload.visible = true;
          s.faceModelDownload.status = "running";
          s.faceModelDownload.message = event.message;
          s.faceModelDownload.filename = event.filename;
          s.faceModelDownload.percent = event.percent;
          s.faceModelDownload.downloadedBytes = event.downloadedBytes;
          s.faceModelDownload.totalBytes = event.totalBytes;
          s.faceModelDownload.error = null;
          return;
        }
        if (event.type === "completed") {
          s.faceModelDownload.visible = false;
          s.faceModelDownload.status = "completed";
          s.faceModelDownload.message = event.message;
          s.faceModelDownload.durationMs = event.durationMs;
          return;
        }
        s.faceModelDownload.visible = true;
        s.faceModelDownload.status = "failed";
        s.faceModelDownload.message = event.message;
        s.faceModelDownload.error = event.error;
        s.faceModelDownload.durationMs = event.durationMs;
      });
    });

    return () => {
      cleanupAnalysis();
      cleanupFace();
      cleanupFaceClustering();
      cleanupSimilarUntaggedCounts();
      cleanupMetadata();
      cleanupSemantic();
      cleanupPathAnalysis();
      cleanupImageRotation();
      cleanupGeocoder();
      cleanupMetadataRefreshed();
      cleanupFaceModelDownload();
      clearPendingRefreshTimers();
    };
  }, [store]);
}

export function useDesktopInitialization(): void {
  const store = useDesktopStoreApi();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    void window.desktopApi
      .getSettings()
      .then((settings) => {
        store.setState((s) => {
          s.clientId = settings.clientId;
          s.libraryRoots = settings.libraryRoots;
          s.sidebarCollapsed = settings.sidebarCollapsed;
          s.hideAdvancedSettings = settings.hideAdvancedSettings;
          s.wrongImageRotationDetectionSettings = settings.wrongImageRotationDetection;
          s.faceDetectionSettings = settings.faceDetection;
          s.photoAnalysisSettings = {
            ...DEFAULT_PHOTO_ANALYSIS_SETTINGS,
            ...(settings.photoAnalysis ?? {}),
          };
          // Keep the global AI slice selection in sync with settings (model is now configured in Settings).
          if (settings.photoAnalysis?.model) {
            s.aiSelectedModel = settings.photoAnalysis.model;
          }
          s.folderScanningSettings = settings.folderScanning;
          s.smartAlbumSettings = settings.smartAlbums;
          s.aiImageSearchSettings = settings.aiImageSearch;
          s.mediaViewerSettings = settings.mediaViewer;
          s.pathExtractionSettings = settings.pathExtraction;
          s.aiInferencePreferredGpuId = settings.aiInferencePreferredGpuId;
          s.pipelineConcurrencySettings = settings.pipelineConcurrency;
        });
        // Initial refreshFolderAnalysisStatuses runs before libraryRoots are loaded from settings,
        // so rollup batch was empty and sidebar icons stayed on the loading spinner until interaction.
        void refreshFolderAiRollups(store);
      })
      .catch(() => undefined);

    void refreshFolderAnalysisStatuses(store);
    void window.desktopApi
      .getAiInferenceGpuOptions()
      .then((options) => {
        store.getState().setAiInferenceGpuOptions(options);
      })
      .catch(() => {
        store.getState().setAiInferenceGpuOptions([
          {
            id: "auto",
            label: "Automatic (runtime default)",
            dmlDeviceId: null,
            source: "auto",
          },
        ]);
      });

    void window.desktopApi.pipelines
      .getSnapshot()
      .then((snapshot) => {
        const hasRunning = (pipelineId: string): boolean =>
          snapshot.running.some((bundle) =>
            bundle.jobs.some((job) => job.pipelineId === pipelineId && job.state === "running"),
          );
        store.setState((s) => {
          if (hasRunning("photo-analysis") && !s.aiJobId) {
            s.aiJobId = "running";
            s.aiStatus = "running";
            s.aiPhase = "analyzing";
            s.aiPanelVisible = true;
          }
          if (hasRunning("face-detection") && !s.faceJobId) {
            s.faceJobId = "running";
            s.faceStatus = "running";
            s.facePanelVisible = true;
          }
          if (hasRunning("semantic-index") && !s.semanticIndexJobId) {
            s.semanticIndexJobId = "running";
            s.semanticIndexStatus = "running";
            s.semanticIndexPanelVisible = true;
            s.semanticIndexPhase = "indexing";
          }
          if (hasRunning("path-llm-analysis") && !s.pathAnalysisJobId) {
            s.pathAnalysisJobId = "running";
            s.pathAnalysisStatus = "running";
            s.pathAnalysisPanelVisible = true;
            s.pathAnalysisFolderPath = s.pathAnalysisFolderPath || null;
          }
        });
      })
      .catch(() => undefined);

    void window.desktopApi
      .getSemanticEmbeddingStatus()
      .then((status) => {
        let label: string;
        const textReady = status.textEmbeddingReady || status.onnxTextEmbeddingReady;
        if (!textReady) {
          label = `Embedding model unavailable: ${status.lastProbeError ?? "text embedding failed"}`;
        } else {
          let vision: string;
          if (status.visionOnnxReady) {
            vision = "Direct vision embedding ready (nomic-embed-vision ONNX).";
          } else if (status.visionModelReady) {
            vision = "Text embedding ready; using VLM caption fallback (slower).";
          } else {
            vision = "Text embedding ready; vision model unavailable (images without AI metadata will be skipped).";
          }
          const backend = ` Vector backend: ${status.vectorBackend}.`;
          const backendError = status.vectorBackendError
            ? ` sqlite-vec fallback reason: ${status.vectorBackendError}`
            : "";
          label = `${vision}${backend}${backendError}`;
        }
        store.setState((s) => {
          s.semanticCapabilityLabel = label;
        });
      })
      .catch(() => {
        store.setState((s) => {
          s.semanticCapabilityLabel = "Embedding capability status unavailable.";
        });
      });
  }, [store]);
}

export function useDesktopFaceServicePolling(): void {
  const store = useDesktopStoreApi();

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const status = await window.desktopApi.getFaceDetectionServiceStatus();
        if (!mounted) return;
        store.setState((s) => {
          s.faceServiceStatus = {
            healthy: status.healthy,
            running: status.running,
            error: status.error ?? null,
          };
        });
      } catch {
        if (!mounted) return;
        store.setState((s) => {
          s.faceServiceStatus = {
            healthy: false,
            running: false,
            error: "Could not read face detection service status from the app.",
          };
        });
      }
    };

    void refresh();
    const timer = setInterval(() => void refresh(), 10_000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [store]);
}

export function useDesktopSettingsPersistence(): void {
  const store = useDesktopStoreApi();

  useEffect(() => {
    return store.subscribe(
      (state, prev) => {
        if (
          state.libraryRoots !== prev.libraryRoots ||
          state.sidebarCollapsed !== prev.sidebarCollapsed ||
          state.faceDetectionSettings.minConfidenceThreshold !==
            prev.faceDetectionSettings.minConfidenceThreshold ||
          state.faceDetectionSettings.minFaceBoxShortSideRatio !==
            prev.faceDetectionSettings.minFaceBoxShortSideRatio ||
          state.faceDetectionSettings.faceBoxOverlapMergeRatio !==
            prev.faceDetectionSettings.faceBoxOverlapMergeRatio ||
          state.faceDetectionSettings.faceRecognitionSimilarityThreshold !==
            prev.faceDetectionSettings.faceRecognitionSimilarityThreshold ||
          state.faceDetectionSettings.faceGroupPairwiseSimilarityThreshold !==
            prev.faceDetectionSettings.faceGroupPairwiseSimilarityThreshold ||
          state.faceDetectionSettings.faceGroupMinSize !==
            prev.faceDetectionSettings.faceGroupMinSize ||
          state.faceDetectionSettings.imageOrientationDetection.model !==
            prev.faceDetectionSettings.imageOrientationDetection.model ||
          state.wrongImageRotationDetectionSettings.enabled !==
            prev.wrongImageRotationDetectionSettings.enabled ||
          state.wrongImageRotationDetectionSettings.useFaceLandmarkFeaturesFallback !==
            prev.wrongImageRotationDetectionSettings.useFaceLandmarkFeaturesFallback ||
          state.faceDetectionSettings.faceLandmarkRefinement.enabled !==
            prev.faceDetectionSettings.faceLandmarkRefinement.enabled ||
          state.faceDetectionSettings.faceLandmarkRefinement.model !==
            prev.faceDetectionSettings.faceLandmarkRefinement.model ||
          state.faceDetectionSettings.faceAgeGenderDetection.enabled !==
            prev.faceDetectionSettings.faceAgeGenderDetection.enabled ||
          state.faceDetectionSettings.faceAgeGenderDetection.model !==
            prev.faceDetectionSettings.faceAgeGenderDetection.model ||
          state.photoAnalysisSettings.analysisTimeoutPerImageSec !==
            prev.photoAnalysisSettings.analysisTimeoutPerImageSec ||
          state.photoAnalysisSettings.model !==
            prev.photoAnalysisSettings.model ||
          state.photoAnalysisSettings.downscaleBeforeLlm !==
            prev.photoAnalysisSettings.downscaleBeforeLlm ||
          state.photoAnalysisSettings.downscaleLongestSidePx !==
            prev.photoAnalysisSettings.downscaleLongestSidePx ||
          state.photoAnalysisSettings.enableTwoPassRotationConsistency !==
            prev.photoAnalysisSettings.enableTwoPassRotationConsistency ||
          state.photoAnalysisSettings.extractInvoiceData !==
            prev.photoAnalysisSettings.extractInvoiceData ||
          state.photoAnalysisSettings.folderIconWhenPhotoAnalysisPending !==
            prev.photoAnalysisSettings.folderIconWhenPhotoAnalysisPending ||
          state.hideAdvancedSettings !== prev.hideAdvancedSettings ||
          state.folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder !==
            prev.folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder ||
          state.folderScanningSettings.autoMetadataScanOnSelectMaxFiles !==
            prev.folderScanningSettings.autoMetadataScanOnSelectMaxFiles ||
          state.folderScanningSettings.writeEmbeddedMetadataOnUserEdit !==
            prev.folderScanningSettings.writeEmbeddedMetadataOnUserEdit ||
          state.folderScanningSettings.detectLocationFromGps !==
            prev.folderScanningSettings.detectLocationFromGps ||
          state.folderScanningSettings.markFolderScanOutdatedAfterDays !==
            prev.folderScanningSettings.markFolderScanOutdatedAfterDays ||
          state.smartAlbumSettings.defaultStarRating !==
            prev.smartAlbumSettings.defaultStarRating ||
          state.smartAlbumSettings.defaultStarRatingOperator !==
            prev.smartAlbumSettings.defaultStarRatingOperator ||
          state.smartAlbumSettings.defaultAiRating !==
            prev.smartAlbumSettings.defaultAiRating ||
          state.smartAlbumSettings.defaultAiRatingOperator !==
            prev.smartAlbumSettings.defaultAiRatingOperator ||
          state.aiImageSearchSettings.hideResultsBelowVlmSimilarity !==
            prev.aiImageSearchSettings.hideResultsBelowVlmSimilarity ||
          state.aiImageSearchSettings.hideResultsBelowDescriptionSimilarity !==
            prev.aiImageSearchSettings.hideResultsBelowDescriptionSimilarity ||
          state.aiImageSearchSettings.searchPromptTranslationModel !==
            prev.aiImageSearchSettings.searchPromptTranslationModel ||
          state.aiImageSearchSettings.keywordMatchReranking !==
            prev.aiImageSearchSettings.keywordMatchReranking ||
          state.aiImageSearchSettings.keywordMatchThresholdVlm !==
            prev.aiImageSearchSettings.keywordMatchThresholdVlm ||
          state.aiImageSearchSettings.keywordMatchThresholdDescription !==
            prev.aiImageSearchSettings.keywordMatchThresholdDescription ||
          state.mediaViewerSettings.autoPlayVideoOnOpen !==
            prev.mediaViewerSettings.autoPlayVideoOnOpen ||
          state.mediaViewerSettings.skipVideosInSlideshow !==
            prev.mediaViewerSettings.skipVideosInSlideshow ||
          state.pathExtractionSettings.extractDates !==
            prev.pathExtractionSettings.extractDates ||
          state.pathExtractionSettings.useLlm !==
            prev.pathExtractionSettings.useLlm ||
          state.pathExtractionSettings.llmModelPrimary !==
            prev.pathExtractionSettings.llmModelPrimary ||
          state.pathExtractionSettings.llmModelFallback !==
            prev.pathExtractionSettings.llmModelFallback ||
          state.aiInferencePreferredGpuId !== prev.aiInferencePreferredGpuId ||
          pipelineConcurrencyChanged(
            state.pipelineConcurrencySettings,
            prev.pipelineConcurrencySettings,
          )
        ) {
          void window.desktopApi.saveSettings({
            clientId: state.clientId,
            libraryRoots: state.libraryRoots,
            sidebarCollapsed: state.sidebarCollapsed,
            hideAdvancedSettings: state.hideAdvancedSettings,
            wrongImageRotationDetection: state.wrongImageRotationDetectionSettings,
            faceDetection: state.faceDetectionSettings,
            photoAnalysis: state.photoAnalysisSettings,
            folderScanning: state.folderScanningSettings,
            smartAlbums: state.smartAlbumSettings,
            aiImageSearch: state.aiImageSearchSettings,
            mediaViewer: state.mediaViewerSettings,
            pathExtraction: state.pathExtractionSettings,
            aiInferencePreferredGpuId: state.aiInferencePreferredGpuId,
            pipelineConcurrency: state.pipelineConcurrencySettings,
          });
        }
      },
    );
  }, [store]);
}

function pipelineConcurrencyChanged(
  next: import("../../shared/pipeline-types").PipelineConcurrencyConfig,
  prev: import("../../shared/pipeline-types").PipelineConcurrencyConfig,
): boolean {
  if (
    next.groupLimits.gpu !== prev.groupLimits.gpu ||
    next.groupLimits.ollama !== prev.groupLimits.ollama ||
    next.groupLimits.cpu !== prev.groupLimits.cpu ||
    next.groupLimits.io !== prev.groupLimits.io
  ) {
    return true;
  }
  // Override map equality (shallow). Both undefined → unchanged.
  const a = next.perPipelineGroupOverride ?? {};
  const b = prev.perPipelineGroupOverride ?? {};
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return true;
  for (const k of aKeys) {
    if ((a as Record<string, string>)[k] !== (b as Record<string, string>)[k]) return true;
  }
  return false;
}

export { refreshFolderAnalysisStatuses, refreshMetadataForItems } from "./ipc-binding-helpers";
