import type { ReactElement } from "react";
import type { FolderAiPipelineCounts } from "../../../shared/ipc";
import { formatCoveragePercent, pipelineIsComplete } from "../../lib/folder-ai-summary-formatters";
import { SummaryCardStatusIndicator } from "./SummaryStatusPrimitives";
import { statusTone } from "./summary-card-formatters";

export function SummaryStatusGlyph({
  pipeline,
}: {
  pipeline: FolderAiPipelineCounts;
}): ReactElement {
  const tone = statusTone(pipeline);
  const complete = pipelineIsComplete(pipeline);
  const processedCount = Math.min(pipeline.doneCount + pipeline.failedCount, pipeline.totalImages);
  if ((pipeline.label === "done" || (pipeline.label === "partial" && complete)) && pipeline.totalImages > 0) {
    return <SummaryCardStatusIndicator tone={tone} />;
  }
  if (pipeline.label === "partial" && pipeline.totalImages > 0) {
    return <SummaryCardStatusIndicator tone={tone} percentLabel={formatCoveragePercent(processedCount, pipeline.totalImages)} />;
  }
  if (pipeline.label === "not_done" && pipeline.totalImages > 0) {
    return <SummaryCardStatusIndicator tone={tone} percentLabel="0%" />;
  }
  return <SummaryCardStatusIndicator tone={tone} empty />;
}
