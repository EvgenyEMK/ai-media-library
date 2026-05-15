import type { TaskStatus } from "@emk/media-store";
import type { FaceClusteringProgressPhase } from "../../shared/ipc";
import { formatCount, formatCountRatio } from "./progress-stats-format";

export interface FaceClusteringProgressStatsInput {
  status: TaskStatus;
  phase: FaceClusteringProgressPhase | null;
  processed: number;
  total: number;
  totalFaces: number;
  clusterCount: number | null;
}

/**
 * Single-line progress stats for the face-grouping dock card, aligned with
 * {@link buildPipelineQueueStatsText} / face detection (counts + "Faces: …").
 *
 * The backend reports pairwise comparisons during clustering (see
 * `runAgglomerativeClusteringAsync` in the main process); loading and persist phases
 * use different units, so the leading label matches the unit.
 */
export function buildFaceClusteringStatsText(input: FaceClusteringProgressStatsInput): string {
  const total = progressTotal(input);
  const processed = Math.min(input.processed, total);
  const parts = [
    `${progressMetricPrefix(input)}: ${formatCountRatio(processed, total)}`,
    `Faces: ${formatCount(input.totalFaces)}`,
  ];
  if (input.clusterCount !== null) {
    parts.push(`Groups: ${formatCount(input.clusterCount)}`);
  }
  return parts.join(" | ");
}

function progressTotal(input: FaceClusteringProgressStatsInput): number {
  if (input.status === "running" && input.phase === "loading") {
    return Math.max(1, input.totalFaces);
  }
  return Math.max(1, input.total);
}

function progressMetricPrefix(input: FaceClusteringProgressStatsInput): string {
  if (input.status === "running" && input.phase === "loading") {
    return "Preparing faces";
  }
  if (input.phase === "clustering") {
    return "Processed face pairs";
  }
  if (input.phase === "persisting") {
    return "Saving clusters";
  }
  if (input.phase === "refreshing-suggestions") {
    return "Refreshing suggestions";
  }
  if (input.status === "completed") {
    return "Clusters saved";
  }
  if (input.phase === null) {
    const n = input.totalFaces;
    if (input.processed === 0 && input.total === n) {
      return "Preparing faces";
    }
    const pairTotal = (n * (n - 1)) / 2;
    if (input.total === pairTotal || input.total > n) {
      return "Processed face pairs";
    }
    return "Saving clusters";
  }
  return "Saving clusters";
}
