import type { PipelineQueueSnapshot } from "../../shared/pipeline-types";
import type { DuplicateFilesSession } from "../types/duplicate-files-session";

/**
 * Locates the `folder-duplicate-scan` job id for a bundle returned from `enqueueBundle` (single-job bundle).
 */
export function findFolderDuplicateScanJobId(
  snapshot: PipelineQueueSnapshot,
  bundleId: string,
): string | null {
  const bundles = [...snapshot.running, ...snapshot.queued, ...snapshot.recent];
  const bundle = bundles.find((b) => b.bundleId === bundleId);
  const job = bundle?.jobs.find((j) => j.pipelineId === "folder-duplicate-scan");
  return job?.jobId ?? null;
}

export function duplicateScanSessionMatchesJobFinished(
  session: Extract<DuplicateFilesSession, { kind: "scanning" }>,
  event: { jobId: string; bundleId: string },
): boolean {
  if (session.jobId) {
    return session.jobId === event.jobId;
  }
  return session.bundleId === event.bundleId;
}
