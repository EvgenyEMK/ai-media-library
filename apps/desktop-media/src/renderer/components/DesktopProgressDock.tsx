import { useEffect, type ReactElement } from "react";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";
import { UI_TEXT } from "../lib/ui-text";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import { formatCount, formatCountRatio } from "../lib/progress-stats-format";
import type { AnalysisEtaState, FaceEtaState, MetadataProgressState, SemanticIndexEtaState } from "../hooks/use-eta-tracking";

// TEMPORARY: description embedding backfill — remove after migration
export interface DescEmbedBackfillState {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  jobId: string | null;
  processed: number;
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  error: string | null;
  panelVisible: boolean;
}

interface DesktopProgressDockProps {
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
  analysisEta: AnalysisEtaState;
  faceEta: FaceEtaState;
  metadataProgress: MetadataProgressState;
  semanticIndexEta: SemanticIndexEtaState;
  onCancelMetadataScan: () => void;
  onCancelAnalysis: () => void;
  onCancelFaceDetection: () => void;
  onCancelSemanticIndex: () => void;
  onCancelFaceClustering: () => void;
  onCancelSimilarUntaggedFaceCounts: () => void;
  onCancelPathAnalysis: () => void;
  // TEMPORARY: description embedding backfill — remove after migration
  descEmbedBackfill?: DescEmbedBackfillState;
  onCancelDescEmbedBackfill?: () => void;
  onDismissDescEmbedBackfill?: () => void;
}

export function DesktopProgressDock({
  collapsed,
  onToggleCollapsed,
  analysisEta,
  faceEta,
  metadataProgress,
  semanticIndexEta,
  onCancelMetadataScan,
  onCancelAnalysis,
  onCancelFaceDetection,
  onCancelSemanticIndex,
  onCancelFaceClustering,
  onCancelSimilarUntaggedFaceCounts,
  onCancelPathAnalysis,
  // TEMPORARY: description embedding backfill — remove after migration
  descEmbedBackfill,
  onCancelDescEmbedBackfill,
  onDismissDescEmbedBackfill,
}: DesktopProgressDockProps): ReactElement | null {
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
    faceClusteringPhase === "persisting"
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

  // TEMPORARY: description embedding backfill — remove after migration
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

  const geocoderInitStatus = useDesktopStore((s) => s.geocoderInitStatus);
  const geocoderInitError = useDesktopStore((s) => s.geocoderInitError);
  const geocoderInitPanelVisible = useDesktopStore((s) => s.geocoderInitPanelVisible);

  const isGeocoderInitRunning = geocoderInitStatus === "downloading" || geocoderInitStatus === "parsing";
  const geocoderQualifies =
    geocoderInitPanelVisible &&
    (isGeocoderInitRunning ||
      geocoderInitStatus === "ready" ||
      geocoderInitStatus === "error");

  const isPathAnalysisRunning = pathAnalysisStatus === "running";
  const pathAnalysisQualifies =
    pathAnalysisPanelVisible &&
    (isPathAnalysisRunning || Boolean(pathAnalysisError));

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
    geocoderQualifies;

  const shouldShow = !viewerOpen && hasAnyQualifyingCard;

  useEffect(() => {
    if (viewerOpen || hasAnyQualifyingCard) return;
    const anyVisible =
      metadataPanelVisible ||
      aiPanelVisible ||
      facePanelVisible ||
      semanticIndexPanelVisible ||
      faceClusteringPanelVisible ||
      similarUntaggedCountsPanelVisible ||
      pathAnalysisPanelVisible ||
      geocoderInitPanelVisible;
    if (!anyVisible) return;
    store.setState((s) => {
      s.metadataPanelVisible = false;
      s.aiPanelVisible = false;
      s.facePanelVisible = false;
      s.semanticIndexPanelVisible = false;
      s.faceClusteringPanelVisible = false;
      s.similarUntaggedCountsPanelVisible = false;
      s.pathAnalysisPanelVisible = false;
      s.geocoderInitPanelVisible = false;
    });
  }, [
    viewerOpen,
    hasAnyQualifyingCard,
    metadataPanelVisible,
    aiPanelVisible,
    facePanelVisible,
    semanticIndexPanelVisible,
    faceClusteringPanelVisible,
    similarUntaggedCountsPanelVisible,
    pathAnalysisPanelVisible,
    geocoderInitPanelVisible,
    store,
  ]);

  if (!shouldShow) return null;

  return (
    <section
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t border-border bg-[#101623]"
      aria-label={UI_TEXT.progressPanelTitle}
    >
      <div
        className={cn(
          "box-border flex min-h-7 shrink-0 items-center justify-center px-2.5 py-1",
          collapsed && "min-h-[22px] px-2 py-0.5",
        )}
      >
        <div className="flex items-center justify-center gap-2.5">
          <span className="select-none whitespace-nowrap text-[11px] font-semibold tracking-wide text-muted-foreground">
            {UI_TEXT.progressPanelTitle}
          </span>
          <button
            type="button"
            className="inline-flex h-[18px] w-11 min-w-11 shrink-0 items-center justify-center rounded border border-[#3d4a63] bg-[#1a2333] p-0 text-[#a8b8d8] shadow-none transition-colors hover:border-[#556380] hover:bg-[#232d42] hover:text-[#d4dff5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#79d7a4]"
            title={collapsed ? UI_TEXT.progressPanelExpand : UI_TEXT.progressPanelCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? UI_TEXT.progressPanelExpand : UI_TEXT.progressPanelCollapse}
            onClick={() => onToggleCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronUp size={14} aria-hidden="true" strokeWidth={2.25} />
            ) : (
              <ChevronDown size={14} aria-hidden="true" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="grid max-h-[180px] gap-2 overflow-auto p-2">
        {metadataQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">
                {metadataProgress.metadataCardTitle}
                {metadataProgress.metadataFolderName ? ` - ${metadataProgress.metadataFolderName}` : ""}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={isMetadataScanning ? UI_TEXT.cancelScan : "Close metadata scan status"}
                  aria-label={isMetadataScanning ? UI_TEXT.cancelScan : "Close metadata scan status"}
                  disabled={isMetadataScanning && !metadataJobId}
                  onClick={() => {
                    if (isMetadataScanning) {
                      onCancelMetadataScan();
                    }
                    store.getState().setMetadataPanelVisible(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {(isMetadataScanning || metadataProgress.metadataTotal > 0) && (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]"
                  aria-label={
                    metadataPhase === "preparing"
                      ? UI_TEXT.metadataScanPreparing
                      : metadataPhase === "scanning"
                        ? UI_TEXT.metadataScanScanning
                        : "Metadata scan progress"
                  }
                >
                  <div
                    className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
                    style={{ width: `${metadataProgress.metadataDisplayProgressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {isMetadataScanning && metadataPhase === "preparing"
                    ? metadataProgress.metadataProgressLabel + " " + formatCountRatio(metadataPhaseProcessed, metadataPhaseTotal)
                    : `${metadataProgress.metadataProgressLabel ? `${metadataProgress.metadataProgressLabel} ` : ""}Processed: ${formatCountRatio(metadataProgress.metadataProcessed, metadataProgress.metadataTotal)} | New: ${formatCount(metadataProgress.metadataCounts.created)} | Updated: ${formatCount(metadataProgress.metadataCounts.updated)}`}
                  {metadataProgress.metadataCounts.failed > 0
                    ? ` | Failed: ${formatCount(metadataProgress.metadataCounts.failed)}`
                    : ""}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {aiQualifies ? (
          <section className="desktop-progress-card m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">
                {UI_TEXT.analysisPanelTitle}
                {isAnalyzing && aiCurrentFolderPath ? ` - ${aiCurrentFolderPath.split(/[\\/]/).pop()}` : ""}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={isAnalyzing ? UI_TEXT.cancelPhotoAnalysis : "Close photo analysis status"}
                  aria-label={isAnalyzing ? UI_TEXT.cancelPhotoAnalysis : "Close photo analysis status"}
                  disabled={isAnalyzing && !aiJobId}
                  onClick={() => {
                    if (isAnalyzing) {
                      onCancelAnalysis();
                    }
                    store.getState().setAiPanelVisible(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {aiError && <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">{aiError}</div>}
            {isAnalyzing && aiPhase === "initializing-model" ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>{UI_TEXT.analysisLoadingModel}</span>
              </div>
            ) : isAnalyzing && analysisEta.analysisItems.length === 0 ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>{UI_TEXT.preparingFiles}</span>
              </div>
            ) : analysisEta.analysisItems.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Local AI analysis progress">
                  <div className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear" style={{ width: `${analysisEta.analysisProgressPercent}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {`Processed: ${formatCountRatio(analysisEta.analysisProcessed, analysisEta.analysisTotal)} | Skipped: ${formatCount(analysisEta.analysisCounts.skipped)}`}
                  {analysisEta.analysisTimeLeftText
                    ? ` | ${UI_TEXT.analysisTimeLeftLabel}: ${analysisEta.analysisTimeLeftText}`
                    : ""}
                  {analysisEta.analysisCounts.failed > 0
                    ? ` | Failed: ${formatCount(analysisEta.analysisCounts.failed)}`
                    : ""}
                  {analysisEta.analysisCounts.cancelled > 0
                    ? ` | Cancelled: ${formatCount(analysisEta.analysisCounts.cancelled)}`
                    : ""}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {faceQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">
                {UI_TEXT.faceDetectionPanelTitle}
                {isDetectingFaces && faceCurrentFolderPath
                  ? ` - ${faceCurrentFolderPath.split(/[\\/]/).pop()}`
                  : ""}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={isDetectingFaces ? UI_TEXT.cancelFaceDetection : "Close face detection status"}
                  aria-label={isDetectingFaces ? UI_TEXT.cancelFaceDetection : "Close face detection status"}
                  disabled={isDetectingFaces && !faceJobId}
                  onClick={() => {
                    if (isDetectingFaces) {
                      onCancelFaceDetection();
                    }
                    store.getState().setFacePanelVisible(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            {faceServiceStatus && !faceServiceStatus.healthy ? (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/30 p-2 text-xs text-red-200">
                {UI_TEXT.faceDetectionServiceUnavailable}
                {faceServiceStatus.error ? ` Error: ${faceServiceStatus.error}` : ""}
              </div>
            ) : null}

            {faceError && <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">{faceError}</div>}

            {isDetectingFaces && faceEta.faceTotal === 0 ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>{UI_TEXT.preparingFiles}</span>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Face detection progress">
                  <div className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear" style={{ width: `${faceEta.faceProgressPercent}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {`Processed: ${formatCountRatio(faceEta.faceProcessed, faceEta.faceTotal)} | Skipped: ${formatCount(faceEta.faceCounts.skipped)} | ${UI_TEXT.faceCountLabel}: ${formatCount(faceEta.faceCounts.faces)}`}
                  {faceEta.faceTimeLeftText
                    ? ` | ${UI_TEXT.analysisTimeLeftLabel}: ${faceEta.faceTimeLeftText}`
                    : ""}
                  {faceEta.faceCounts.failed > 0 ? ` | Failed: ${formatCount(faceEta.faceCounts.failed)}` : ""}
                  {faceEta.faceCounts.cancelled > 0 ? ` | Cancelled: ${formatCount(faceEta.faceCounts.cancelled)}` : ""}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {faceClusteringQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.faceClusteringPanelTitle}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={
                    isFaceClusteringRunning
                      ? UI_TEXT.faceClusteringCancel
                      : UI_TEXT.faceClusteringClose
                  }
                  aria-label={
                    isFaceClusteringRunning
                      ? UI_TEXT.faceClusteringCancel
                      : UI_TEXT.faceClusteringClose
                  }
                  disabled={isFaceClusteringRunning && !faceClusteringJobId}
                  onClick={() => {
                    if (isFaceClusteringRunning) {
                      onCancelFaceClustering();
                    }
                    store.getState().setFaceClusteringPanelVisible(false);
                    store.getState().resetFaceClustering();
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {faceClusteringError ? (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">{faceClusteringError}</div>
            ) : null}
            {isFaceClusteringRunning ? (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Face grouping progress">
                  <div
                    className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
                    style={{ width: `${faceClusteringProgressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {`${faceClusteringPhaseLabel} ${formatCountRatio(faceClusteringProcessed, faceClusteringTotal)}`}
                  {faceClusteringTotalFaces > 0 && faceClusteringPhase === "loading"
                    ? ` | ${formatCount(faceClusteringTotalFaces)} faces`
                    : ""}
                </div>
              </div>
            ) : faceClusteringStatus === "completed" && faceClusteringClusterCount !== null ? (
              <div className="text-xs text-muted-foreground">
                {`Done: ${formatCount(faceClusteringClusterCount)} group${faceClusteringClusterCount === 1 ? "" : "s"}`}
              </div>
            ) : faceClusteringStatus === "cancelled" ? (
              <div className="text-xs text-muted-foreground">Cancelled.</div>
            ) : null}
          </section>
        ) : null}

        {semanticQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">
                {UI_TEXT.semanticIndexPanelTitle}
                {isSemanticIndexing && semanticIndexCurrentFolderPath
                  ? ` - ${semanticIndexCurrentFolderPath.split(/[\\/]/).pop()}`
                  : ""}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={isSemanticIndexing ? UI_TEXT.cancelSemanticIndex : "Close AI search indexing status"}
                  aria-label={isSemanticIndexing ? UI_TEXT.cancelSemanticIndex : "Close AI search indexing status"}
                  disabled={isSemanticIndexing && !semanticIndexJobId}
                  onClick={() => {
                    if (isSemanticIndexing) {
                      onCancelSemanticIndex();
                    }
                    store.getState().setSemanticIndexPanelVisible(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            {semanticIndexError && <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">{semanticIndexError}</div>}

            {isSemanticIndexing && semanticIndexPhase === "initializing-model" ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>{UI_TEXT.semanticIndexLoadingVisionModel}</span>
              </div>
            ) : isSemanticIndexing && semanticIndexEta.semanticIndexItems.length === 0 ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>{UI_TEXT.preparingFiles}</span>
              </div>
            ) : semanticIndexEta.semanticIndexItems.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="AI search indexing progress">
                  <div className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear" style={{ width: `${semanticIndexEta.semanticIndexProgressPercent}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {`Processed: ${formatCountRatio(
                    semanticIndexEta.semanticIndexProcessed,
                    semanticIndexEta.semanticIndexTotal,
                  )}`}
                  {semanticIndexEta.semanticIndexTimeLeftText
                    ? ` | ${UI_TEXT.analysisTimeLeftLabel}: ${semanticIndexEta.semanticIndexTimeLeftText}`
                    : ""}
                  {semanticIndexEta.semanticIndexCounts.failed > 0
                    ? ` | Failed: ${formatCount(semanticIndexEta.semanticIndexCounts.failed)}`
                    : ""}
                  {semanticIndexEta.semanticIndexCounts.cancelled > 0
                    ? ` | Cancelled: ${formatCount(semanticIndexEta.semanticIndexCounts.cancelled)}`
                    : ""}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {pathAnalysisQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">
                {UI_TEXT.progressPathAnalysisTitle}
                {pathAnalysisFolderPath ? ` - ${pathAnalysisFolderPath.split(/[\\/]/).pop()}` : ""}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={isPathAnalysisRunning ? "Cancel path metadata extraction" : "Close"}
                  aria-label={isPathAnalysisRunning ? "Cancel path metadata extraction" : "Close"}
                  disabled={isPathAnalysisRunning && !pathAnalysisJobId}
                  onClick={() => {
                    if (isPathAnalysisRunning) {
                      onCancelPathAnalysis();
                    }
                    store.setState((s) => {
                      s.pathAnalysisPanelVisible = false;
                      s.pathAnalysisError = null;
                    });
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {pathAnalysisError ? (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
                {pathAnalysisError}
              </div>
            ) : null}
            {isPathAnalysisRunning ? (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Path LLM progress">
                  <div
                    className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
                    style={{
                      width: `${pathAnalysisTotal > 0 ? Math.min(100, (pathAnalysisProcessed / pathAnalysisTotal) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCountRatio(pathAnalysisProcessed, pathAnalysisTotal)}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {similarUntaggedCountsQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.similarUntaggedCountsPanelTitle}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={
                    isSimilarUntaggedCountsRunning
                      ? UI_TEXT.similarUntaggedCountsCancel
                      : UI_TEXT.similarUntaggedCountsClose
                  }
                  aria-label={
                    isSimilarUntaggedCountsRunning
                      ? UI_TEXT.similarUntaggedCountsCancel
                      : UI_TEXT.similarUntaggedCountsClose
                  }
                  onClick={() => {
                    if (isSimilarUntaggedCountsRunning) {
                      onCancelSimilarUntaggedFaceCounts();
                    }
                    store.getState().setSimilarUntaggedCountsPanelVisible(false);
                    store.getState().resetSimilarUntaggedCountsJob();
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {similarUntaggedCountsError ? (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">{similarUntaggedCountsError}</div>
            ) : null}
            {isSimilarUntaggedCountsRunning ? (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Similar face counts progress">
                  <div
                    className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
                    style={{ width: `${similarUntaggedCountsProgressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {`People: ${formatCountRatio(similarUntaggedCountsProcessed, similarUntaggedCountsTotal)}`}
                </div>
              </div>
            ) : similarUntaggedCountsStatus === "completed" ? (
              <div className="text-xs text-muted-foreground">Done.</div>
            ) : similarUntaggedCountsStatus === "cancelled" ? (
              <div className="text-xs text-muted-foreground">Cancelled.</div>
            ) : null}
          </section>
        ) : null}

        {geocoderQualifies ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.geocoderInitPanelTitle}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Close"
                  aria-label="Close"
                  onClick={() => {
                    store.getState().setGeocoderInitPanelVisible(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {geocoderInitError ? (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
                {UI_TEXT.geocoderInitError} {geocoderInitError}
              </div>
            ) : null}
            {isGeocoderInitRunning ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>
                  {geocoderInitStatus === "downloading"
                    ? UI_TEXT.geocoderInitDownloading
                    : UI_TEXT.geocoderInitParsing}
                </span>
              </div>
            ) : geocoderInitStatus === "ready" ? (
              <div className="text-xs text-muted-foreground">{UI_TEXT.geocoderInitReady}</div>
            ) : null}
          </section>
        ) : null}

        {/* TEMPORARY: description embedding backfill card — remove after migration */}
        {descEmbedQualifies && descEmbedBackfill ? (
          <section className="m-0 rounded-lg border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.descEmbedBackfillPanelTitle}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={descEmbedRunning ? UI_TEXT.cancelDescEmbedBackfill : "Close"}
                  aria-label={descEmbedRunning ? UI_TEXT.cancelDescEmbedBackfill : "Close"}
                  disabled={descEmbedRunning && !descEmbedBackfill.jobId}
                  onClick={() => {
                    if (descEmbedRunning) {
                      onCancelDescEmbedBackfill?.();
                    }
                    onDismissDescEmbedBackfill?.();
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {descEmbedBackfill.error ? (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">{descEmbedBackfill.error}</div>
            ) : null}
            {descEmbedRunning && descEmbedBackfill.total === 0 ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>{UI_TEXT.preparingFiles}</span>
              </div>
            ) : descEmbedBackfill.total > 0 ? (
              <div className="mt-2 flex flex-col gap-2 overflow-auto">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Description embedding progress">
                  <div className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear" style={{ width: `${descEmbedProgressPercent}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {`Processed: ${formatCountRatio(descEmbedBackfill.processed, descEmbedBackfill.total)} | Indexed: ${formatCount(descEmbedBackfill.indexed)}`}
                  {descEmbedBackfill.skipped > 0 ? ` | Skipped: ${formatCount(descEmbedBackfill.skipped)}` : ""}
                  {descEmbedBackfill.failed > 0 ? ` | Failed: ${formatCount(descEmbedBackfill.failed)}` : ""}
                  {descEmbedBackfill.status === "completed" ? " | Done" : ""}
                  {descEmbedBackfill.status === "cancelled" ? " | Cancelled" : ""}
                </div>
              </div>
            ) : descEmbedBackfill.status === "completed" ? (
              <div className="text-xs text-muted-foreground">Done: {formatCount(descEmbedBackfill.indexed)} indexed</div>
            ) : descEmbedBackfill.status === "cancelled" ? (
              <div className="text-xs text-muted-foreground">Cancelled.</div>
            ) : null}
          </section>
        ) : null}
        </div>
      ) : null}
    </section>
  );
}
