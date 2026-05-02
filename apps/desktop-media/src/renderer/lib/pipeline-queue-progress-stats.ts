import type { JobView, PipelineId } from "../../shared/pipeline-types";
import { formatCount, formatCountRatio } from "./progress-stats-format";

export function buildPipelineQueueStatsText(job: JobView): string {
  const processed = job.progress.total != null
    ? formatCountRatio(job.progress.processed, job.progress.total)
    : `${formatCount(job.progress.processed)} / ?`;
  const extra = pipelineMetricText(job.pipelineId, job.progress.details);
  const skipped = numberDetail(job.progress.details, "skipped");
  const failed = failedCountForJob(job);
  return `Processed: ${processed}${extra ? ` | ${extra}` : ""}${skipped > 0 ? ` | Skipped: ${formatCount(skipped)}` : ""}${failed > 0 ? ` | Failed: ${formatCount(failed)}` : ""}`;
}

export function buildPipelineQueueRightText(job: JobView): string | null {
  if (job.pipelineId !== "photo-analysis" || job.state !== "running" || job.progress.processed > 0) {
    return null;
  }
  const model = stringDetail(job.progress.details, "model");
  if (!model) return null;
  return `Loading AI model ${model} - it may take 1-2min`;
}

function pipelineMetricText(pipelineId: PipelineId, details: unknown): string | null {
  if (pipelineId === "face-detection") {
    return `Faces: ${formatCount(numberDetail(details, "totalFacesDetected"))}`;
  }
  if (pipelineId === "image-rotation-precheck") {
    return `Wrongly rotated: ${formatCount(numberDetail(details, "wronglyRotated"))}`;
  }
  if (pipelineId === "gps-geocode") {
    return `With GPS: ${formatCount(numberDetail(details, "geoDataUpdated"))}`;
  }
  return null;
}

function failedCountForJob(job: JobView): number {
  const detailedFailed = numberDetail(job.progress.details, "failed");
  if (detailedFailed > 0) return detailedFailed;
  return job.state === "failed" ? 1 : 0;
}

function numberDetail(details: unknown, key: string): number {
  if (typeof details !== "object" || details === null) return 0;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringDetail(details: unknown, key: string): string | null {
  if (typeof details !== "object" || details === null) return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
