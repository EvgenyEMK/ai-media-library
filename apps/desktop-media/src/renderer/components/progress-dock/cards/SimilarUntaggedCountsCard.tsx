import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import type { TaskStatus } from "@emk/media-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";
import { ProgressCardBody } from "./ProgressCardBody";

interface SimilarUntaggedCountsCardProps {
  store: DesktopStore;
  isSimilarUntaggedCountsRunning: boolean;
  similarUntaggedCountsJobId: string | null;
  similarUntaggedCountsProgressPercent: number;
  similarUntaggedCountsProcessed: number;
  similarUntaggedCountsTotal: number;
  similarUntaggedCountsStatus: TaskStatus;
  similarUntaggedCountsError: string | null;
  onCancelSimilarUntaggedFaceCounts: () => void;
}

export function SimilarUntaggedCountsCard({
  store,
  isSimilarUntaggedCountsRunning,
  similarUntaggedCountsJobId,
  similarUntaggedCountsProgressPercent,
  similarUntaggedCountsProcessed,
  similarUntaggedCountsTotal,
  similarUntaggedCountsStatus,
  similarUntaggedCountsError,
  onCancelSimilarUntaggedFaceCounts,
}: SimilarUntaggedCountsCardProps): ReactElement {
  const similarUntaggedCountsTimeLeftText = useProgressEta({
    running: isSimilarUntaggedCountsRunning,
    jobId: similarUntaggedCountsJobId,
    processed: similarUntaggedCountsProcessed,
    total: similarUntaggedCountsTotal,
  });
  const progressPercent = similarUntaggedCountsProgressPercent;
  const rightText = similarUntaggedCountsTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${similarUntaggedCountsTimeLeftText}`
    : null;

  return (
    <ProgressCardBody
      title={UI_TEXT.similarUntaggedCountsPanelTitle}
      action={
        <ProgressDockCloseButton
          title={
            isSimilarUntaggedCountsRunning ? UI_TEXT.similarUntaggedCountsCancel : UI_TEXT.similarUntaggedCountsClose
          }
          ariaLabel={
            isSimilarUntaggedCountsRunning ? UI_TEXT.similarUntaggedCountsCancel : UI_TEXT.similarUntaggedCountsClose
          }
          onClick={() => {
            if (isSimilarUntaggedCountsRunning) {
              onCancelSimilarUntaggedFaceCounts();
            }
            store.getState().setSimilarUntaggedCountsPanelVisible(false);
            store.getState().resetSimilarUntaggedCountsJob();
          }}
        />
      }
      progressPercent={progressPercent}
      ariaLabel="Similar face counts progress"
      statsText={`People: ${formatCountRatio(similarUntaggedCountsProcessed, similarUntaggedCountsTotal)}`}
      rightText={rightText}
      error={similarUntaggedCountsError}
      showProgress={isSimilarUntaggedCountsRunning}
      footer={!isSimilarUntaggedCountsRunning && similarUntaggedCountsStatus === "completed" ? "Done." : !isSimilarUntaggedCountsRunning && similarUntaggedCountsStatus === "cancelled" ? "Cancelled." : null}
    />
  );
}
