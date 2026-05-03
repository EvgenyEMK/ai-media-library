import type { ReactElement } from "react";
import type { FolderAiPipelineCounts } from "../../../shared/ipc";
import { formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { SummaryMetricGrid, type SummaryMetricGridItem } from "./SummaryMetricGrid";
import type { SummaryStatusTone } from "./summary-card-types";

export function SummaryStatusLines({
  pipeline,
  completedLabel = "Analyzed",
  issueLabel,
  tone = "neutral",
  extraItems = [],
}: {
  pipeline: FolderAiPipelineCounts;
  completedLabel?: string;
  issueLabel?: string;
  tone?: SummaryStatusTone;
  extraItems?: SummaryMetricGridItem[];
}): ReactElement {
  const hasMedia = pipeline.totalImages > 0;
  const issueCount = pipeline.issueCount ?? 0;
  const done = pipeline.doneCount;
  const processed = Math.min(done + pipeline.failedCount, pipeline.totalImages);
  const remaining = Math.max(pipeline.totalImages - processed, 0);
  const showActionFirst = tone === "amber" || tone === "red";
  const showAnalyzedLine = tone !== "red" && tone !== "amber";
  const actionToneClass = tone === "amber" ? "text-warning" : "text-destructive";
  const failedToneClass = tone === "green" ? "text-warning" : "text-destructive";

  const items: SummaryMetricGridItem[] = [];
  if (hasMedia && showActionFirst && remaining > 0) {
    items.push({ label: "To analyze", value: formatGroupedInt(remaining), valueClassName: actionToneClass });
  }
  if (hasMedia && showAnalyzedLine) {
    items.push({ label: completedLabel, value: formatGroupedInt(done) });
  }
  if (pipeline.failedCount > 0) {
    items.push({ label: "Failed", value: formatGroupedInt(pipeline.failedCount), valueClassName: failedToneClass });
  }
  if (issueLabel && hasMedia) {
    items.push({
      label: issueLabel,
      value: formatGroupedInt(issueCount),
      valueClassName: issueCount > 0 ? "text-warning" : undefined,
    });
  }
  items.push(...extraItems);

  return (
    <>
      {items.length > 0 ? <SummaryMetricGrid items={items} /> : null}
      {!hasMedia ? <span>{UI_TEXT.folderAiSummaryStatusEmpty}</span> : null}
    </>
  );
}
