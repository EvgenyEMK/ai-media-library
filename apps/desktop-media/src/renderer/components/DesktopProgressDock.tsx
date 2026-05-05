import { useEffect, useState, type ReactElement } from "react";
import { ListPlus } from "lucide-react";
import { UI_TEXT } from "../lib/ui-text";
import { ProgressDockCards } from "./progress-dock/ProgressDockCards";
import { ProgressDockHeader } from "./progress-dock/ProgressDockHeader";
import { PipelineQueueCards } from "./progress-dock/PipelineQueueCards";
import { RunPipelinesSheet } from "./RunPipelinesSheet";
import type { DescEmbedBackfillState } from "./progress-dock/types";
import { useDesktopProgressDockState } from "./progress-dock/use-desktop-progress-dock-state";
import { useDesktopStore } from "../stores/desktop-store";
import type { AnalysisEtaState, FaceEtaState, MetadataProgressState, SemanticIndexEtaState } from "../hooks/use-eta-tracking";

export type { DescEmbedBackfillState };

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
  onCancelImageRotation: () => void;
  descEmbedBackfill?: DescEmbedBackfillState;
  onCancelDescEmbedBackfill?: () => void;
  onDismissDescEmbedBackfill?: () => void;
  /** Callback invoked by the new "Run pipelines…" header button. */
  onOpenRunPipelinesSheet?: () => void;
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
  onCancelImageRotation,
  descEmbedBackfill,
  onCancelDescEmbedBackfill,
  onDismissDescEmbedBackfill,
  onOpenRunPipelinesSheet,
}: DesktopProgressDockProps): ReactElement | null {
  const dock = useDesktopProgressDockState({
    analysisEta,
    faceEta,
    metadataProgress,
    semanticIndexEta,
    descEmbedBackfill,
  });

  const { store, viewerOpen, hasAnyQualifyingCard } = dock;
  // Bundles enqueued through the new PipelineScheduler. The dock should remain
  // visible whenever any bundle is queued/running/recently-finished, even when
  // no legacy per-feature cards qualify.
  const pipelineRunning = useDesktopStore((s) => s.pipelineRunning);
  const pipelineQueued = useDesktopStore((s) => s.pipelineQueued);
  const pipelineRecent = useDesktopStore((s) => s.pipelineRecent);
  const selectedFolder = useDesktopStore((s) => s.selectedFolder);
  const hasPipelineQueueActivity =
    pipelineRunning.length > 0 || pipelineQueued.length > 0 || pipelineRecent.length > 0;
  const isAnyPipelineRunning = pipelineRunning.length > 0 || dock.hasAnyRunningOperation;

  const [sheetOpen, setSheetOpen] = useState<boolean>(false);

  const shouldShow = !viewerOpen && (hasAnyQualifyingCard || hasPipelineQueueActivity);

  useEffect(() => {
    if (viewerOpen || hasAnyQualifyingCard) return;
    const anyVisible =
      dock.metadataPanelVisible ||
      dock.aiPanelVisible ||
      dock.facePanelVisible ||
      dock.semanticIndexPanelVisible ||
      dock.faceClusteringPanelVisible ||
      dock.similarUntaggedCountsPanelVisible ||
      dock.pathAnalysisPanelVisible ||
      dock.imageRotationPanelVisible ||
      dock.geocoderInitPanelVisible;
    if (!anyVisible) return;
    store.setState((s) => {
      s.metadataPanelVisible = false;
      s.aiPanelVisible = false;
      s.facePanelVisible = false;
      s.semanticIndexPanelVisible = false;
      s.faceClusteringPanelVisible = false;
      s.similarUntaggedCountsPanelVisible = false;
      s.pathAnalysisPanelVisible = false;
      s.imageRotationPanelVisible = false;
      s.geocoderInitPanelVisible = false;
    });
  }, [
    viewerOpen,
    hasAnyQualifyingCard,
    dock.metadataPanelVisible,
    dock.aiPanelVisible,
    dock.facePanelVisible,
    dock.semanticIndexPanelVisible,
    dock.faceClusteringPanelVisible,
    dock.similarUntaggedCountsPanelVisible,
    dock.pathAnalysisPanelVisible,
    dock.imageRotationPanelVisible,
    dock.geocoderInitPanelVisible,
    store,
  ]);

  // Sheet may be opened externally via prop callback (e.g. from a folder
  // context menu) but the dock also exposes its own button when visible. To
  // avoid losing the "Run pipelines…" affordance when nothing is running, we
  // also accept an external onOpenRunPipelinesSheet to allow callers to host
  // their own trigger and have us render the same sheet.
  const handleOpenSheet = (): void => {
    if (onOpenRunPipelinesSheet) onOpenRunPipelinesSheet();
    else setSheetOpen(true);
  };

  if (!shouldShow) {
    // Idle state: render a slim, low-profile strip with just the
    // "Run pipelines…" affordance. The dock is primarily a progress
    // surface; the idle bar exists only so users can launch a bundle from
    // a cold app state without hunting in folder context menus. Hidden
    // entirely while the photo viewer is open to preserve immersive view.
    if (viewerOpen) {
      return sheetOpen ? (
        <RunPipelinesSheet
          defaultFolderPath={selectedFolder}
          isAnyPipelineRunning={isAnyPipelineRunning}
          onClose={() => setSheetOpen(false)}
        />
      ) : null;
    }
    return (
      <>
        <section
          className="absolute bottom-0 left-0 right-0 z-30 flex h-[22px] items-center justify-end border-t border-border bg-[#101623]/85 px-2"
          aria-label="Background operations idle"
        >
          <button
            type="button"
            className="inline-flex h-[18px] items-center gap-1 rounded border border-[#3d4a63] bg-[#1a2333] px-1.5 text-[10px] font-medium tracking-wide text-[#a8b8d8] shadow-none transition-colors hover:border-[#556380] hover:bg-[#232d42] hover:text-[#d4dff5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#79d7a4]"
            title="Run pipelines"
            aria-label="Run pipelines"
            onClick={handleOpenSheet}
          >
            <ListPlus size={12} aria-hidden="true" />
            Run pipelines
          </button>
        </section>
        {sheetOpen ? (
          <RunPipelinesSheet
            defaultFolderPath={selectedFolder}
            isAnyPipelineRunning={isAnyPipelineRunning}
            onClose={() => setSheetOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <section
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t border-border bg-[#101623]"
      aria-label={UI_TEXT.progressPanelTitle}
    >
      <ProgressDockHeader
        collapsed={collapsed}
        hasAnyRunningOperation={isAnyPipelineRunning}
        onToggleCollapsed={onToggleCollapsed}
        onOpenRunPipelinesSheet={handleOpenSheet}
      />
      {sheetOpen ? (
        <RunPipelinesSheet
          defaultFolderPath={selectedFolder}
          isAnyPipelineRunning={isAnyPipelineRunning}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {!collapsed ? (
        <div className="grid max-h-[220px] gap-2 overflow-auto p-2">
          <ProgressDockCards
            dock={dock}
            analysisEta={analysisEta}
            faceEta={faceEta}
            metadataProgress={metadataProgress}
            semanticIndexEta={semanticIndexEta}
            onCancelMetadataScan={onCancelMetadataScan}
            onCancelAnalysis={onCancelAnalysis}
            onCancelFaceDetection={onCancelFaceDetection}
            onCancelSemanticIndex={onCancelSemanticIndex}
            onCancelFaceClustering={onCancelFaceClustering}
            onCancelSimilarUntaggedFaceCounts={onCancelSimilarUntaggedFaceCounts}
            onCancelPathAnalysis={onCancelPathAnalysis}
            onCancelImageRotation={onCancelImageRotation}
            descEmbedBackfill={descEmbedBackfill}
            onCancelDescEmbedBackfill={onCancelDescEmbedBackfill}
            onDismissDescEmbedBackfill={onDismissDescEmbedBackfill}
          />
          <PipelineQueueCards />
        </div>
      ) : null}
    </section>
  );
}
