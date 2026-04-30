import type { AiAnalysisSlice } from "@emk/media-store";
import type { ReactElement } from "react";
import type { AnalysisEtaState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

interface AnalysisCardProps {
  store: DesktopStore;
  analysisEta: AnalysisEtaState;
  isAnalyzing: boolean;
  aiJobId: string | null;
  aiError: string | null;
  aiCurrentFolderPath: string | null;
  aiPhase: AiAnalysisSlice["aiPhase"];
  onCancelAnalysis: () => void;
}

export function AnalysisCard({
  store,
  analysisEta,
  isAnalyzing,
  aiJobId,
  aiError,
  aiCurrentFolderPath,
  aiPhase,
  onCancelAnalysis,
}: AnalysisCardProps): ReactElement {
  const foundCount = Math.max(
    0,
    analysisEta.analysisProcessed -
      analysisEta.analysisCounts.skipped -
      analysisEta.analysisCounts.failed -
      analysisEta.analysisCounts.cancelled,
  );
  const titlePrefix =
    isAnalyzing && aiPhase === "initializing-model"
      ? "1/2: "
      : isAnalyzing && aiPhase === "analyzing"
        ? "2/2: "
        : "";
  const shouldShowProgress = isAnalyzing || analysisEta.analysisItems.length > 0;
  const progressPercent = analysisEta.analysisProgressPercent;
  const statsText = `Processed: ${formatCountRatio(analysisEta.analysisProcessed, analysisEta.analysisTotal)} | Analyzed: ${formatCount(foundCount)}${
    analysisEta.analysisCounts.skipped > 0 ? ` | Skipped: ${formatCount(analysisEta.analysisCounts.skipped)}` : ""
  }${analysisEta.analysisCounts.failed > 0 ? ` | Failed: ${formatCount(analysisEta.analysisCounts.failed)}` : ""}${
    analysisEta.analysisCounts.cancelled > 0 ? ` | Cancelled: ${formatCount(analysisEta.analysisCounts.cancelled)}` : ""
  }`;
  const rightText = analysisEta.analysisTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${analysisEta.analysisTimeLeftText}`
    : null;

  return (
    <ProgressCardBody
      title={`${titlePrefix}${UI_TEXT.analysisPanelTitle}${
        isAnalyzing && aiCurrentFolderPath ? ` - ${aiCurrentFolderPath.split(/[\\/]/).pop()}` : ""
      }`}
      action={
        <ProgressDockCloseButton
          title={isAnalyzing ? UI_TEXT.cancelPhotoAnalysis : "Close photo analysis status"}
          ariaLabel={isAnalyzing ? UI_TEXT.cancelPhotoAnalysis : "Close photo analysis status"}
          disabled={isAnalyzing && !aiJobId}
          onClick={() => {
            if (isAnalyzing) {
              onCancelAnalysis();
            }
            store.getState().setAiPanelVisible(false);
          }}
        />
      }
      progressPercent={progressPercent}
      ariaLabel="Local AI analysis progress"
      statsText={statsText}
      rightText={rightText}
      error={aiError}
      showProgress={shouldShowProgress}
    />
  );
}
