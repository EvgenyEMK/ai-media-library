import { useDesktopStore, useDesktopStoreApi } from "../../stores/desktop-store";
import type { AnalysisEtaState, FaceEtaState, MetadataProgressState, SemanticIndexEtaState } from "../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../lib/ui-text";
import type { DescEmbedBackfillState } from "./types";

export interface DesktopProgressDockEtaInputs {
  analysisEta: AnalysisEtaState;
  faceEta: FaceEtaState;
  metadataProgress: MetadataProgressState;
  semanticIndexEta: SemanticIndexEtaState;
  descEmbedBackfill?: DescEmbedBackfillState;
}

/**
 * Subscriptions and derived flags for the Background operations dock.
 * Keeps `DesktopProgressDock` focused on layout and wiring.
 */
export function useDesktopProgressDockState({
  analysisEta,
  faceEta,
  metadataProgress,
  semanticIndexEta,
  descEmbedBackfill,
}: DesktopProgressDockEtaInputs) {
  const store = useDesktopStoreApi();

  const aiPanelVisible = useDesktopStore((s) => s.aiPanelVisible);
  const aiStatus = useDesktopStore((s) => s.aiStatus);
  const aiJobId = useDesktopStore((s) => s.aiJobId);
  const aiError = useDesktopStore((s) => s.aiError);
  const aiCurrentFolderPath = useDesktopStore((s) => s.aiCurrentFolderPath);
  const aiPhase = useDesktopStore((s) => s.aiPhase);
  const facePanelVisible = useDesktopStore((s) => s.facePanelVisible);
  const faceStatus = useDesktopStore((s) => s.faceStatus);
  const faceJobId = useDesktopStore((s) => s.faceJobId);
  const faceError = useDesktopStore((s) => s.faceError);
  const faceCurrentFolderPath = useDesktopStore((s) => s.faceCurrentFolderPath);
  const faceServiceStatus = useDesktopStore((s) => s.faceServiceStatus);
  const metadataPanelVisible = useDesktopStore((s) => s.metadataPanelVisible);
  const metadataStatus = useDesktopStore((s) => s.metadataStatus);
  const metadataJobId = useDesktopStore((s) => s.metadataJobId);
  const metadataPhase = useDesktopStore((s) => s.metadataPhase);
  const metadataPhaseProcessed = useDesktopStore((s) => s.metadataPhaseProcessed);
  const metadataPhaseTotal = useDesktopStore((s) => s.metadataPhaseTotal);
  const semanticIndexPanelVisible = useDesktopStore((s) => s.semanticIndexPanelVisible);
  const semanticIndexStatus = useDesktopStore((s) => s.semanticIndexStatus);
  const semanticIndexJobId = useDesktopStore((s) => s.semanticIndexJobId);
  const semanticIndexError = useDesktopStore((s) => s.semanticIndexError);
  const semanticIndexCurrentFolderPath = useDesktopStore((s) => s.semanticIndexCurrentFolderPath);
  const semanticIndexPhase = useDesktopStore((s) => s.semanticIndexPhase);
  const viewerOpen = useDesktopStore((s) => s.viewerOpen);
  const faceClusteringPanelVisible = useDesktopStore((s) => s.faceClusteringPanelVisible);
  const faceClusteringStatus = useDesktopStore((s) => s.faceClusteringStatus);
  const faceClusteringJobId = useDesktopStore((s) => s.faceClusteringJobId);
  const faceClusteringError = useDesktopStore((s) => s.faceClusteringError);
  const faceClusteringPhase = useDesktopStore((s) => s.faceClusteringPhase);
  const faceClusteringProcessed = useDesktopStore((s) => s.faceClusteringProcessed);
  const faceClusteringTotal = useDesktopStore((s) => s.faceClusteringTotal);
  const faceClusteringClusterCount = useDesktopStore((s) => s.faceClusteringClusterCount);
  const faceClusteringTotalFaces = useDesktopStore((s) => s.faceClusteringTotalFaces);
  const similarUntaggedCountsPanelVisible = useDesktopStore(
    (s) => s.similarUntaggedCountsPanelVisible,
  );
  const similarUntaggedCountsStatus = useDesktopStore((s) => s.similarUntaggedCountsStatus);
  const similarUntaggedCountsJobId = useDesktopStore((s) => s.similarUntaggedCountsJobId);
  const similarUntaggedCountsProcessed = useDesktopStore(
    (s) => s.similarUntaggedCountsProcessed,
  );
  const similarUntaggedCountsTotal = useDesktopStore((s) => s.similarUntaggedCountsTotal);
  const similarUntaggedCountsError = useDesktopStore((s) => s.similarUntaggedCountsError);
  const pathAnalysisPanelVisible = useDesktopStore((s) => s.pathAnalysisPanelVisible);
  const pathAnalysisStatus = useDesktopStore((s) => s.pathAnalysisStatus);
  const pathAnalysisJobId = useDesktopStore((s) => s.pathAnalysisJobId);
  const pathAnalysisProcessed = useDesktopStore((s) => s.pathAnalysisProcessed);
  const pathAnalysisTotal = useDesktopStore((s) => s.pathAnalysisTotal);
  const pathAnalysisFolderPath = useDesktopStore((s) => s.pathAnalysisFolderPath);
  const pathAnalysisError = useDesktopStore((s) => s.pathAnalysisError);
  const imageRotationPanelVisible = useDesktopStore((s) => s.imageRotationPanelVisible);
  const imageRotationStatus = useDesktopStore((s) => s.imageRotationStatus);
  const imageRotationJobId = useDesktopStore((s) => s.imageRotationJobId);
  const imageRotationProcessed = useDesktopStore((s) => s.imageRotationProcessed);
  const imageRotationTotal = useDesktopStore((s) => s.imageRotationTotal);
  const imageRotationWronglyRotated = useDesktopStore((s) => s.imageRotationWronglyRotated);
  const imageRotationSkipped = useDesktopStore((s) => s.imageRotationSkipped);
  const imageRotationFailed = useDesktopStore((s) => s.imageRotationFailed);
  const imageRotationFolderPath = useDesktopStore((s) => s.imageRotationFolderPath);
  const imageRotationError = useDesktopStore((s) => s.imageRotationError);
  const geocoderInitStatus = useDesktopStore((s) => s.geocoderInitStatus);
  const geocoderInitError = useDesktopStore((s) => s.geocoderInitError);
  const geocoderInitProgressPercent = useDesktopStore((s) => s.geocoderInitProgressPercent);
  const geocoderInitProgressLabel = useDesktopStore((s) => s.geocoderInitProgressLabel);
  const geocoderInitPanelVisible = useDesktopStore((s) => s.geocoderInitPanelVisible);

  const isAnalyzing = aiStatus === "running";
  const isDetectingFaces = faceStatus === "running";
  const isMetadataScanning = metadataStatus === "running";
  const isSemanticIndexing = semanticIndexStatus === "running";
  const isFaceClusteringRunning = faceClusteringStatus === "running";

  const metadataQualifies =
    metadataPanelVisible && (isMetadataScanning || metadataProgress.metadataTotal > 0);
  const aiQualifies =
    aiPanelVisible &&
    (isAnalyzing || analysisEta.analysisItems.length > 0 || Boolean(aiError));
  const faceServiceBannerVisible =
    faceServiceStatus !== null && !faceServiceStatus.healthy;
  const faceQualifies =
    facePanelVisible &&
    (isDetectingFaces || faceEta.faceTotal > 0 || Boolean(faceError) || faceServiceBannerVisible);
  const semanticQualifies =
    semanticIndexPanelVisible &&
    (isSemanticIndexing ||
      semanticIndexEta.semanticIndexItems.length > 0 ||
      Boolean(semanticIndexError));

  const faceClusteringProgressPercent =
    faceClusteringTotal > 0
      ? Math.min(100, (faceClusteringProcessed / faceClusteringTotal) * 100)
      : 0;

  const faceClusteringPhaseLabel =
    faceClusteringPhase === "refreshing-suggestions"
      ? UI_TEXT.faceClusteringPhaseRefreshingSuggestions
      : faceClusteringPhase === "persisting"
      ? UI_TEXT.faceClusteringPhasePersisting
      : faceClusteringPhase === "clustering"
        ? UI_TEXT.faceClusteringPhaseClustering
        : UI_TEXT.faceClusteringPhaseLoading;

  const faceClusteringQualifies =
    faceClusteringPanelVisible &&
    (isFaceClusteringRunning ||
      faceClusteringStatus === "completed" ||
      faceClusteringStatus === "failed" ||
      faceClusteringStatus === "cancelled" ||
      Boolean(faceClusteringError));

  const descEmbedRunning = descEmbedBackfill?.status === "running";
  const descEmbedProgressPercent =
    descEmbedBackfill && descEmbedBackfill.total > 0
      ? Math.min(100, (descEmbedBackfill.processed / descEmbedBackfill.total) * 100)
      : 0;
  const descEmbedQualifies =
    descEmbedBackfill?.panelVisible === true &&
    (descEmbedRunning ||
      descEmbedBackfill.status === "completed" ||
      descEmbedBackfill.status === "failed" ||
      descEmbedBackfill.status === "cancelled" ||
      Boolean(descEmbedBackfill.error));

  const isGeocoderInitRunning =
    geocoderInitStatus === "downloading" ||
    geocoderInitStatus === "loading-cache" ||
    geocoderInitStatus === "parsing";
  const geocoderQualifies =
    geocoderInitPanelVisible &&
    (isGeocoderInitRunning ||
      geocoderInitStatus === "ready" ||
      geocoderInitStatus === "error");

  const isPathAnalysisRunning = pathAnalysisStatus === "running";
  const isImageRotationRunning = imageRotationStatus === "running";
  const pathAnalysisQualifies =
    pathAnalysisPanelVisible &&
    (isPathAnalysisRunning ||
      pathAnalysisStatus === "completed" ||
      Boolean(pathAnalysisError));
  const imageRotationQualifies =
    imageRotationPanelVisible &&
    (isImageRotationRunning ||
      imageRotationStatus === "completed" ||
      imageRotationStatus === "cancelled" ||
      imageRotationStatus === "failed" ||
      Boolean(imageRotationError));

  const isSimilarUntaggedCountsRunning = similarUntaggedCountsStatus === "running";
  const similarUntaggedCountsProgressPercent =
    similarUntaggedCountsTotal > 0
      ? Math.min(100, (similarUntaggedCountsProcessed / similarUntaggedCountsTotal) * 100)
      : 0;
  const similarUntaggedCountsQualifies =
    similarUntaggedCountsPanelVisible &&
    (isSimilarUntaggedCountsRunning ||
      similarUntaggedCountsStatus === "completed" ||
      similarUntaggedCountsStatus === "failed" ||
      similarUntaggedCountsStatus === "cancelled" ||
      Boolean(similarUntaggedCountsError));

  const hasAnyQualifyingCard =
    metadataQualifies ||
    aiQualifies ||
    faceQualifies ||
    semanticQualifies ||
    faceClusteringQualifies ||
    descEmbedQualifies ||
    similarUntaggedCountsQualifies ||
    pathAnalysisQualifies ||
    imageRotationQualifies ||
    geocoderQualifies;
  const hasAnyRunningOperation =
    isAnalyzing ||
    isDetectingFaces ||
    isMetadataScanning ||
    isSemanticIndexing ||
    isFaceClusteringRunning ||
    descEmbedRunning ||
    isSimilarUntaggedCountsRunning ||
    isPathAnalysisRunning ||
    isImageRotationRunning ||
    isGeocoderInitRunning;

  return {
    store,
    viewerOpen,
    aiPanelVisible,
    facePanelVisible,
    semanticIndexPanelVisible,
    faceClusteringPanelVisible,
    similarUntaggedCountsPanelVisible,
    pathAnalysisPanelVisible,
    imageRotationPanelVisible,
    geocoderInitPanelVisible,
    metadataPanelVisible,
    hasAnyQualifyingCard,
    hasAnyRunningOperation,
    metadataQualifies,
    aiQualifies,
    faceQualifies,
    semanticQualifies,
    faceClusteringQualifies,
    descEmbedQualifies,
    similarUntaggedCountsQualifies,
    pathAnalysisQualifies,
    imageRotationQualifies,
    geocoderQualifies,
    isAnalyzing,
    isDetectingFaces,
    isMetadataScanning,
    isSemanticIndexing,
    isFaceClusteringRunning,
    isGeocoderInitRunning,
    isPathAnalysisRunning,
    isImageRotationRunning,
    isSimilarUntaggedCountsRunning,
    descEmbedRunning,
    descEmbedProgressPercent,
    aiJobId,
    aiError,
    aiCurrentFolderPath,
    aiPhase,
    faceJobId,
    faceError,
    faceCurrentFolderPath,
    faceServiceStatus,
    faceServiceBannerVisible,
    metadataJobId,
    metadataPhase,
    metadataPhaseProcessed,
    metadataPhaseTotal,
    semanticIndexJobId,
    semanticIndexError,
    semanticIndexCurrentFolderPath,
    semanticIndexPhase,
    faceClusteringJobId,
    faceClusteringError,
    faceClusteringPhase,
    faceClusteringProcessed,
    faceClusteringTotal,
    faceClusteringClusterCount,
    faceClusteringTotalFaces,
    faceClusteringProgressPercent,
    faceClusteringPhaseLabel,
    faceClusteringStatus,
    similarUntaggedCountsJobId,
    similarUntaggedCountsProcessed,
    similarUntaggedCountsTotal,
    similarUntaggedCountsProgressPercent,
    similarUntaggedCountsStatus,
    similarUntaggedCountsError,
    pathAnalysisJobId,
    pathAnalysisProcessed,
    pathAnalysisTotal,
    pathAnalysisFolderPath,
    pathAnalysisError,
    imageRotationJobId,
    imageRotationStatus,
    imageRotationProcessed,
    imageRotationTotal,
    imageRotationWronglyRotated,
    imageRotationSkipped,
    imageRotationFailed,
    imageRotationFolderPath,
    imageRotationError,
    geocoderInitStatus,
    geocoderInitError,
    geocoderInitProgressPercent,
    geocoderInitProgressLabel,
  };
}

export type DesktopProgressDockModel = ReturnType<typeof useDesktopProgressDockState>;
