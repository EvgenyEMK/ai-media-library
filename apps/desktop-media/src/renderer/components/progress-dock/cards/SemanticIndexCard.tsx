import type { SemanticSearchSlice } from "@emk/media-store";
import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { SemanticIndexEtaState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

interface SemanticIndexCardProps {
  store: DesktopStore;
  semanticIndexEta: SemanticIndexEtaState;
  isSemanticIndexing: boolean;
  semanticIndexJobId: string | null;
  semanticIndexError: string | null;
  semanticIndexCurrentFolderPath: string | null;
  semanticIndexPhase: SemanticSearchSlice["semanticIndexPhase"];
  onCancelSemanticIndex: () => void;
}

export function SemanticIndexCard({
  store,
  semanticIndexEta,
  isSemanticIndexing,
  semanticIndexJobId,
  semanticIndexError,
  semanticIndexCurrentFolderPath,
  semanticIndexPhase,
  onCancelSemanticIndex,
}: SemanticIndexCardProps): ReactElement {
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">
          {UI_TEXT.semanticIndexPanelTitle}
          {isSemanticIndexing && semanticIndexCurrentFolderPath
            ? ` - ${semanticIndexCurrentFolderPath.split(/[\\/]/).pop()}`
            : ""}
        </h2>
        <div className="flex items-center gap-2">
          <ProgressDockCloseButton
            title={isSemanticIndexing ? UI_TEXT.cancelSemanticIndex : "Close AI search indexing status"}
            ariaLabel={isSemanticIndexing ? UI_TEXT.cancelSemanticIndex : "Close AI search indexing status"}
            disabled={isSemanticIndexing && !semanticIndexJobId}
            onClick={() => {
              if (isSemanticIndexing) {
                onCancelSemanticIndex();
              }
              store.getState().setSemanticIndexPanelVisible(false);
            }}
          />
        </div>
      </div>

      {semanticIndexError && (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {semanticIndexError}
        </div>
      )}

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
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${semanticIndexEta.semanticIndexProgressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>
                {`Processed: ${formatCountRatio(
                  semanticIndexEta.semanticIndexProcessed,
                  semanticIndexEta.semanticIndexTotal,
                )}`}
                {semanticIndexEta.semanticIndexCounts.failed > 0
                  ? ` | Failed: ${formatCount(semanticIndexEta.semanticIndexCounts.failed)}`
                  : ""}
                {semanticIndexEta.semanticIndexCounts.cancelled > 0
                  ? ` | Cancelled: ${formatCount(semanticIndexEta.semanticIndexCounts.cancelled)}`
                  : ""}
              </span>
              {semanticIndexEta.semanticIndexTimeLeftText ? (
                <span className="shrink-0">
                  {UI_TEXT.analysisTimeLeftLabel}: {semanticIndexEta.semanticIndexTimeLeftText}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
