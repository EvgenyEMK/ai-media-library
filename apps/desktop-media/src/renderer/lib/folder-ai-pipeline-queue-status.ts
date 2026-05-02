import { findActiveFolderPipelineMatch } from "../../shared/pipeline-folder-scope";
import type { BundleView, PipelineId } from "../../shared/pipeline-types";
import type { SummaryPipelineKind } from "../types/folder-ai-summary-types";

export type FolderAiPipelineQueueStatus = "running" | "queued" | null;

const pipelineIdsBySummaryKind: Record<SummaryPipelineKind, PipelineId> = {
  semantic: "semantic-index",
  face: "face-detection",
  photo: "photo-analysis",
  rotation: "image-rotation-precheck",
};

export function getFolderAiPipelineQueueStatus(options: {
  running: BundleView[];
  queued: BundleView[];
  pipeline: SummaryPipelineKind;
  folderPath: string;
}): FolderAiPipelineQueueStatus {
  const pipelineId = pipelineIdsBySummaryKind[options.pipeline];
  const runningMatch = findActiveFolderPipelineMatch({
    bundles: options.running,
    pipelineId,
    folderPath: options.folderPath,
  });
  if (runningMatch) return runningMatch.state === "running" ? "running" : "queued";

  const queuedMatch = findActiveFolderPipelineMatch({
    bundles: options.queued,
    pipelineId,
    folderPath: options.folderPath,
  });
  return queuedMatch ? "queued" : null;
}
