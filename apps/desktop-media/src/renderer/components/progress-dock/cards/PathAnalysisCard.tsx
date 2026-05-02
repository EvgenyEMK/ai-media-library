import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";
import { ProgressCardBody } from "./ProgressCardBody";

interface PathAnalysisCardProps {
  store: DesktopStore;
  isPathAnalysisRunning: boolean;
  pathAnalysisJobId: string | null;
  pathAnalysisProcessed: number;
  pathAnalysisTotal: number;
  pathAnalysisFolderPath: string | null;
  pathAnalysisError: string | null;
  onCancelPathAnalysis: () => void;
}

export function PathAnalysisCard({
  store,
  isPathAnalysisRunning,
  pathAnalysisJobId,
  pathAnalysisProcessed,
  pathAnalysisTotal,
  pathAnalysisFolderPath,
  pathAnalysisError,
  onCancelPathAnalysis,
}: PathAnalysisCardProps): ReactElement {
  const pathPercent =
    pathAnalysisTotal > 0 ? Math.min(100, Math.round((pathAnalysisProcessed / pathAnalysisTotal) * 100)) : 0;
  const pathAnalysisTimeLeftText = useProgressEta({
    running: isPathAnalysisRunning,
    jobId: pathAnalysisJobId,
    processed: pathAnalysisProcessed,
    total: pathAnalysisTotal,
  });
  const rightText = pathAnalysisTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${pathAnalysisTimeLeftText}`
    : null;

  return (
    <ProgressCardBody
      title={`${UI_TEXT.progressPathAnalysisTitle}${
        pathAnalysisFolderPath ? ` - ${pathAnalysisFolderPath.split(/[\\/]/).pop()}` : ""
      }`}
      action={
        <ProgressDockCloseButton
          title={isPathAnalysisRunning ? "Cancel path metadata extraction" : "Close"}
          ariaLabel={isPathAnalysisRunning ? "Cancel path metadata extraction" : "Close"}
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
        />
      }
      progressPercent={pathPercent}
      ariaLabel="Path LLM progress"
      statsText={`Processed: ${formatCountRatio(pathAnalysisProcessed, pathAnalysisTotal)}`}
      rightText={rightText}
      error={pathAnalysisError}
      showProgress={isPathAnalysisRunning || pathAnalysisTotal > 0}
    />
  );
}
