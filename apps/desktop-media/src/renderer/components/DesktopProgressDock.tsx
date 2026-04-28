import { useEffect, type ReactElement } from "react";
import { UI_TEXT } from "../lib/ui-text";
import { ProgressDockCards } from "./progress-dock/ProgressDockCards";
import { ProgressDockHeader } from "./progress-dock/ProgressDockHeader";
import type { DescEmbedBackfillState } from "./progress-dock/types";
import { useDesktopProgressDockState } from "./progress-dock/use-desktop-progress-dock-state";
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
}: DesktopProgressDockProps): ReactElement | null {
  const dock = useDesktopProgressDockState({
    analysisEta,
    faceEta,
    metadataProgress,
    semanticIndexEta,
    descEmbedBackfill,
  });

  const { store, viewerOpen, hasAnyQualifyingCard } = dock;

  const shouldShow = !viewerOpen && hasAnyQualifyingCard;

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

  if (!shouldShow) return null;

  return (
    <section
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t border-border bg-[#101623]"
      aria-label={UI_TEXT.progressPanelTitle}
    >
      <ProgressDockHeader
        collapsed={collapsed}
        hasAnyRunningOperation={dock.hasAnyRunningOperation}
        onToggleCollapsed={onToggleCollapsed}
      />

      {!collapsed ? (
        <div className="grid max-h-[180px] gap-2 overflow-auto p-2">
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
        </div>
      ) : null}
    </section>
  );
}
