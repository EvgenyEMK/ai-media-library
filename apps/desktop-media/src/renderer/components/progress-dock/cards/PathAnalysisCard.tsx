import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";

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
    pathAnalysisTotal > 0 ? Math.min(100, (pathAnalysisProcessed / pathAnalysisTotal) * 100) : 0;
  const pathAnalysisTimeLeftText = useProgressEta({
    running: isPathAnalysisRunning,
    jobId: pathAnalysisJobId,
    processed: pathAnalysisProcessed,
    total: pathAnalysisTotal,
  });

  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">
          {UI_TEXT.progressPathAnalysisTitle}
          {pathAnalysisFolderPath ? ` - ${pathAnalysisFolderPath.split(/[\\/]/).pop()}` : ""}
        </h2>
        <div className="flex items-center gap-2">
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
              style={{ width: `${pathPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>{formatCountRatio(pathAnalysisProcessed, pathAnalysisTotal)}</span>
              {pathAnalysisTimeLeftText ? (
                <span className="shrink-0">
                  {UI_TEXT.analysisTimeLeftLabel}: {pathAnalysisTimeLeftText}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
