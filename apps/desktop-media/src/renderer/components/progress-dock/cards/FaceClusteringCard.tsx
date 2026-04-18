import type { FaceClusteringProgressPhase, TaskStatus } from "@emk/media-store";
import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

interface FaceClusteringCardProps {
  store: DesktopStore;
  isFaceClusteringRunning: boolean;
  faceClusteringJobId: string | null;
  faceClusteringError: string | null;
  faceClusteringPhase: FaceClusteringProgressPhase | null;
  faceClusteringProcessed: number;
  faceClusteringTotal: number;
  faceClusteringProgressPercent: number;
  faceClusteringClusterCount: number | null;
  faceClusteringTotalFaces: number;
  faceClusteringStatus: TaskStatus;
  faceClusteringPhaseLabel: string;
  onCancelFaceClustering: () => void;
}

export function FaceClusteringCard({
  store,
  isFaceClusteringRunning,
  faceClusteringJobId,
  faceClusteringError,
  faceClusteringPhase,
  faceClusteringProcessed,
  faceClusteringTotal,
  faceClusteringProgressPercent,
  faceClusteringClusterCount,
  faceClusteringTotalFaces,
  faceClusteringStatus,
  faceClusteringPhaseLabel,
  onCancelFaceClustering,
}: FaceClusteringCardProps): ReactElement {
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.faceClusteringPanelTitle}</h2>
        <div className="flex items-center gap-2">
          <ProgressDockCloseButton
            title={isFaceClusteringRunning ? UI_TEXT.faceClusteringCancel : UI_TEXT.faceClusteringClose}
            ariaLabel={isFaceClusteringRunning ? UI_TEXT.faceClusteringCancel : UI_TEXT.faceClusteringClose}
            disabled={isFaceClusteringRunning && !faceClusteringJobId}
            onClick={() => {
              if (isFaceClusteringRunning) {
                onCancelFaceClustering();
              }
              store.getState().setFaceClusteringPanelVisible(false);
              store.getState().resetFaceClustering();
            }}
          />
        </div>
      </div>
      {faceClusteringError ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {faceClusteringError}
        </div>
      ) : null}
      {isFaceClusteringRunning ? (
        <div className="mt-2 flex flex-col gap-2 overflow-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Face grouping progress">
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${faceClusteringProgressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {`${faceClusteringPhaseLabel} ${formatCountRatio(faceClusteringProcessed, faceClusteringTotal)}`}
            {faceClusteringTotalFaces > 0 && faceClusteringPhase === "loading"
              ? ` | ${formatCount(faceClusteringTotalFaces)} faces`
              : ""}
          </div>
        </div>
      ) : faceClusteringStatus === "completed" && faceClusteringClusterCount !== null ? (
        <div className="text-xs text-muted-foreground">
          {`Done: ${formatCount(faceClusteringClusterCount)} group${faceClusteringClusterCount === 1 ? "" : "s"}`}
        </div>
      ) : faceClusteringStatus === "cancelled" ? (
        <div className="text-xs text-muted-foreground">Cancelled.</div>
      ) : null}
    </section>
  );
}
