import type { SemanticSearchSlice } from "@emk/media-store";
import type { ReactElement } from "react";
import type { SemanticIndexEtaState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

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
  const foundCount = Math.max(
    0,
    semanticIndexEta.semanticIndexProcessed -
      semanticIndexEta.semanticIndexCounts.failed -
      semanticIndexEta.semanticIndexCounts.cancelled,
  );
  const titlePrefix =
    isSemanticIndexing && semanticIndexPhase === "initializing-model"
      ? "1/2: "
      : isSemanticIndexing && semanticIndexPhase === "indexing"
        ? "2/2: "
        : "";
  const shouldShowProgress = isSemanticIndexing || semanticIndexEta.semanticIndexItems.length > 0;
  const progressPercent = semanticIndexEta.semanticIndexProgressPercent;
  const skippedCount = 0;
  const statsText = `Processed: ${formatCountRatio(
    semanticIndexEta.semanticIndexProcessed,
    semanticIndexEta.semanticIndexTotal,
  )} | Embedded: ${formatCount(foundCount)}${skippedCount > 0 ? ` | Skipped: ${formatCount(skippedCount)}` : ""}${
    semanticIndexEta.semanticIndexCounts.failed > 0
      ? ` | Failed: ${formatCount(semanticIndexEta.semanticIndexCounts.failed)}`
      : ""
  }${
    semanticIndexEta.semanticIndexCounts.cancelled > 0
      ? ` | Cancelled: ${formatCount(semanticIndexEta.semanticIndexCounts.cancelled)}`
      : ""
  }`;
  const rightText = semanticIndexEta.semanticIndexTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${semanticIndexEta.semanticIndexTimeLeftText}`
    : null;

  return (
    <ProgressCardBody
      title={`${titlePrefix}${UI_TEXT.semanticIndexPanelTitle}${
        isSemanticIndexing && semanticIndexCurrentFolderPath
          ? ` - ${semanticIndexCurrentFolderPath.split(/[\\/]/).pop()}`
          : ""
      }`}
      action={
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
      }
      progressPercent={progressPercent}
      ariaLabel="AI search indexing progress"
      statsText={statsText}
      rightText={rightText}
      error={semanticIndexError}
      showProgress={shouldShowProgress}
    />
  );
}
