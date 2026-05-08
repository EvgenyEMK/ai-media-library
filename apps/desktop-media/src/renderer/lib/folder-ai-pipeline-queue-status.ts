import {
  findActiveFolderPipelineMatch,
  folderIsCoveredByScope,
  folderScopeFromParams,
} from "../../shared/pipeline-folder-scope";
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

/**
 * Running / queued pipeline bundles whose `gps-geocode` job applies to `folderPath`
 * (covers geo-only preset while `geocoder-init` or `gps-geocode` runs).
 */
export function getFolderGeoPipelineQueueStatus(options: {
  running: BundleView[];
  queued: BundleView[];
  folderPath: string;
}): FolderAiPipelineQueueStatus {
  const coversFolder = (bundle: BundleView): boolean => {
    const gpsJob = bundle.jobs.find((j) => j.pipelineId === "gps-geocode");
    if (!gpsJob) return false;
    const scope = folderScopeFromParams(gpsJob.params);
    if (!scope) return false;
    return folderIsCoveredByScope(options.folderPath, scope);
  };

  if (options.running.some(coversFolder)) return "running";
  if (options.queued.some(coversFolder)) return "queued";
  return null;
}
