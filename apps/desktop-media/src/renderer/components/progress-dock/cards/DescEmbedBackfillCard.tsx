import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DescEmbedBackfillState } from "../types";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";
import { ProgressCardBody } from "./ProgressCardBody";

interface DescEmbedBackfillCardProps {
  descEmbedBackfill: DescEmbedBackfillState;
  descEmbedRunning: boolean;
  descEmbedProgressPercent: number;
  onCancelDescEmbedBackfill?: () => void;
  onDismissDescEmbedBackfill?: () => void;
}

export function DescEmbedBackfillCard({
  descEmbedBackfill,
  descEmbedRunning,
  descEmbedProgressPercent,
  onCancelDescEmbedBackfill,
  onDismissDescEmbedBackfill,
}: DescEmbedBackfillCardProps): ReactElement {
  const descEmbedTimeLeftText = useProgressEta({
    running: descEmbedRunning,
    jobId: descEmbedBackfill.jobId,
    processed: descEmbedBackfill.processed,
    total: descEmbedBackfill.total,
  });
  const progressPercent = descEmbedProgressPercent;
  const statsText = `Processed: ${formatCountRatio(
    descEmbedBackfill.processed,
    descEmbedBackfill.total,
  )} | Embedded: ${formatCount(descEmbedBackfill.indexed)}${
    descEmbedBackfill.skipped > 0 ? ` | Skipped: ${formatCount(descEmbedBackfill.skipped)}` : ""
  }${descEmbedBackfill.failed > 0 ? ` | Failed: ${formatCount(descEmbedBackfill.failed)}` : ""}${
    descEmbedBackfill.status === "completed" ? " | Done" : ""
  }${descEmbedBackfill.status === "cancelled" ? " | Cancelled" : ""}`;
  const rightText = descEmbedTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${descEmbedTimeLeftText}`
    : null;

  return (
    <ProgressCardBody
      title={UI_TEXT.descEmbedBackfillPanelTitle}
      action={
        <ProgressDockCloseButton
          title={descEmbedRunning ? UI_TEXT.cancelDescEmbedBackfill : "Close"}
          ariaLabel={descEmbedRunning ? UI_TEXT.cancelDescEmbedBackfill : "Close"}
          disabled={descEmbedRunning && !descEmbedBackfill.jobId}
          onClick={() => {
            if (descEmbedRunning) {
              onCancelDescEmbedBackfill?.();
            }
            onDismissDescEmbedBackfill?.();
          }}
        />
      }
      progressPercent={progressPercent}
      ariaLabel="Description embedding progress"
      statsText={statsText}
      rightText={rightText}
      error={descEmbedBackfill.error}
      showProgress={descEmbedRunning || descEmbedBackfill.total > 0}
    />
  );
}
