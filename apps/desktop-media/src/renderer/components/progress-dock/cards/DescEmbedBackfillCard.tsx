import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DescEmbedBackfillState } from "../types";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

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
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.descEmbedBackfillPanelTitle}</h2>
        <div className="flex items-center gap-2">
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
        </div>
      </div>
      {descEmbedBackfill.error ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {descEmbedBackfill.error}
        </div>
      ) : null}
      {descEmbedRunning && descEmbedBackfill.total === 0 ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>{UI_TEXT.preparingFiles}</span>
        </div>
      ) : descEmbedBackfill.total > 0 ? (
        <div className="mt-2 flex flex-col gap-2 overflow-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-label="Description embedding progress">
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${descEmbedProgressPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {`Processed: ${formatCountRatio(descEmbedBackfill.processed, descEmbedBackfill.total)} | Indexed: ${formatCount(descEmbedBackfill.indexed)}`}
            {descEmbedBackfill.skipped > 0 ? ` | Skipped: ${formatCount(descEmbedBackfill.skipped)}` : ""}
            {descEmbedBackfill.failed > 0 ? ` | Failed: ${formatCount(descEmbedBackfill.failed)}` : ""}
            {descEmbedBackfill.status === "completed" ? " | Done" : ""}
            {descEmbedBackfill.status === "cancelled" ? " | Cancelled" : ""}
          </div>
        </div>
      ) : descEmbedBackfill.status === "completed" ? (
        <div className="text-xs text-muted-foreground">Done: {formatCount(descEmbedBackfill.indexed)} indexed</div>
      ) : descEmbedBackfill.status === "cancelled" ? (
        <div className="text-xs text-muted-foreground">Cancelled.</div>
      ) : null}
    </section>
  );
}
