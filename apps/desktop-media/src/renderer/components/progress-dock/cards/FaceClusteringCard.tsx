import type { FaceClusteringProgressPhase, TaskStatus } from "@emk/media-store";
import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";
import { ProgressCardBody } from "./ProgressCardBody";

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
  const faceClusteringTimeLeftText = useProgressEta({
    running: isFaceClusteringRunning,
    jobId: faceClusteringJobId,
    processed: faceClusteringProcessed,
    total: faceClusteringTotal,
  });
  const progressPercent = faceClusteringProgressPercent;
  const statsText = `${faceClusteringPhaseLabel} ${formatCountRatio(
    faceClusteringProcessed,
    faceClusteringTotal,
  )}${faceClusteringTotalFaces > 0 && faceClusteringPhase === "loading" ? ` | Faces: ${formatCount(faceClusteringTotalFaces)}` : ""}`;
  const rightText = faceClusteringTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${faceClusteringTimeLeftText}`
    : null;
  const footer =
    !isFaceClusteringRunning && faceClusteringStatus === "completed" && faceClusteringClusterCount !== null
      ? `Done: ${formatCount(faceClusteringClusterCount)} group${faceClusteringClusterCount === 1 ? "" : "s"}`
      : !isFaceClusteringRunning && faceClusteringStatus === "cancelled"
        ? "Cancelled."
        : null;

  return (
    <ProgressCardBody
      title={UI_TEXT.faceClusteringPanelTitle}
      action={
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
      }
      progressPercent={progressPercent}
      ariaLabel="Face grouping progress"
      statsText={statsText}
      rightText={rightText}
      error={faceClusteringError}
      showProgress={isFaceClusteringRunning}
      footer={footer}
    />
  );
}
