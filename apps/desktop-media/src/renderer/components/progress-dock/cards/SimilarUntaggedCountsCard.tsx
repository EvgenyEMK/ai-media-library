import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import type { TaskStatus } from "@emk/media-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

interface SimilarUntaggedCountsCardProps {
  store: DesktopStore;
  isSimilarUntaggedCountsRunning: boolean;
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
  similarUntaggedCountsProgressPercent,
  similarUntaggedCountsProcessed,
  similarUntaggedCountsTotal,
  similarUntaggedCountsStatus,
  similarUntaggedCountsError,
  onCancelSimilarUntaggedFaceCounts,
}: SimilarUntaggedCountsCardProps): ReactElement {
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.similarUntaggedCountsPanelTitle}</h2>
        <div className="flex items-center gap-2">
          <ProgressDockCloseButton
            title={
              isSimilarUntaggedCountsRunning
                ? UI_TEXT.similarUntaggedCountsCancel
                : UI_TEXT.similarUntaggedCountsClose
            }
            ariaLabel={
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
          />
        </div>
      </div>
      {similarUntaggedCountsError ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {similarUntaggedCountsError}
        </div>
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
  );
}
