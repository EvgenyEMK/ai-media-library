import { Check, CircleDashed, Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderAiPipelineCounts } from "../../../shared/ipc";
import { cn } from "../../lib/cn";
import { formatCoveragePercent, pipelineIsComplete } from "../../lib/folder-ai-summary-formatters";
import { statusTone, toneText } from "./summary-card-formatters";

export function PendingSpinner({ className }: { className?: string }): ReactElement {
  return <Loader2 className={cn("animate-spin text-muted-foreground", className)} aria-hidden="true" />;
}

export function SummaryStatusGlyph({
  pipeline,
}: {
  pipeline: FolderAiPipelineCounts;
}): ReactElement {
  const tone = statusTone(pipeline);
  const complete = pipelineIsComplete(pipeline);
  if ((pipeline.label === "done" || (pipeline.label === "partial" && complete)) && pipeline.totalImages > 0) {
    return <Check size={34} className={toneText(tone)} aria-hidden="true" />;
  }
  if (pipeline.label === "partial" && pipeline.totalImages > 0) {
    return (
      <span className={cn("inline-flex items-center gap-2", toneText(tone))}>
        <CircleDashed size={28} aria-hidden="true" />
        <span className="text-2xl font-semibold leading-none">
          {formatCoveragePercent(pipeline.doneCount, pipeline.totalImages)}
        </span>
      </span>
    );
  }
  if (pipeline.label === "not_done" && pipeline.totalImages > 0) {
    return (
      <span className={cn("inline-flex items-center gap-2", toneText(tone))}>
        <CircleDashed size={28} aria-hidden="true" />
        <span className="text-2xl font-semibold leading-none">0%</span>
      </span>
    );
  }
  return <span className={cn("text-4xl font-semibold leading-none", toneText(tone))}>—</span>;
}
