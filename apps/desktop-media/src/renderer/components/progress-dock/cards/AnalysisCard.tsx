import type { AiAnalysisSlice } from "@emk/media-store";
import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { AnalysisEtaState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

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
  return (
    <section className="desktop-progress-card m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">
          {UI_TEXT.analysisPanelTitle}
          {isAnalyzing && aiCurrentFolderPath ? ` - ${aiCurrentFolderPath.split(/[\\/]/).pop()}` : ""}
        </h2>
        <div className="flex items-center gap-2">
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
        </div>
      </div>
      {aiError && (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {aiError}
        </div>
      )}
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
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${analysisEta.analysisProgressPercent}%` }}
            />
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
            <span className="ml-4 font-medium text-amber-200/95">
              May take several minutes per file depending on settings and hardware
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
