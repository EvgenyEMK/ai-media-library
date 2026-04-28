import type { ReactElement } from "react";
import type { FolderAiPipelineCounts } from "../../../shared/ipc";
import { formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";

export function SummaryStatusLines({
  pipeline,
  completedLabel = "completed",
  issueLabel,
}: {
  pipeline: FolderAiPipelineCounts;
  completedLabel?: string;
  issueLabel?: string;
}): ReactElement {
  const hasMedia = pipeline.totalImages > 0;
  const issueCount = pipeline.issueCount ?? 0;
  return (
    <div className="grid gap-0.5 text-sm text-muted-foreground">
      {hasMedia ? <span>{formatGroupedInt(pipeline.doneCount)} {completedLabel}</span> : null}
      {pipeline.failedCount > 0 ? <span className="text-destructive">{formatGroupedInt(pipeline.failedCount)} failed</span> : null}
      {issueLabel && hasMedia ? (
        <span className={issueCount > 0 ? "text-warning" : undefined}>
          {formatGroupedInt(issueCount)} {issueLabel}
        </span>
      ) : null}
      {!hasMedia ? <span>{UI_TEXT.folderAiSummaryStatusEmpty}</span> : null}
    </div>
  );
}
