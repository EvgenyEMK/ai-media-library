import type { DuplicateMarkedFilesDeleteTarget } from "../../shared/ipc";
import type { EnqueueBundleResponse } from "../../shared/pipeline-ipc";
import { findFolderDuplicateScanJobId } from "../lib/folder-duplicate-scan-queue-helpers";

function rejectionMessage(result: EnqueueBundleResponse): string {
  if (result.ok) return "";
  const rejection = result.rejection;
  switch (rejection.kind) {
    case "validation-failed":
      return rejection.issues;
    case "unknown-pipeline":
      return `Unknown pipeline: ${rejection.pipelineId}`;
    case "duplicate-active-job":
      return rejection.reason;
    case "invalid-binding":
      return rejection.reason;
    default:
      return "Could not enqueue pipeline.";
  }
}

/**
 * Enqueues deletion of catalog files chosen in the duplicate-files view (progress in Background operations).
 */
export async function enqueueDuplicateMarkedFilesDelete(options: {
  targets: DuplicateMarkedFilesDeleteTarget[];
  useTrash: boolean;
  displayName: string;
}): Promise<{ ok: true; bundleId: string } | { ok: false; error: string }> {
  if (options.targets.length === 0) {
    return { ok: false, error: "No files to delete." };
  }

  const result = await window.desktopApi.pipelines.enqueueBundle({
    kind: "single-job",
    payload: {
      pipelineId: "duplicate-marked-files-delete",
      displayName: options.displayName,
      params: { targets: options.targets, useTrash: options.useTrash },
    },
  });

  if (!result.ok) {
    return { ok: false, error: rejectionMessage(result) };
  }

  return { ok: true, bundleId: result.bundleId };
}

async function waitForFolderDuplicateScanJobId(bundleId: string): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const snapshot = await window.desktopApi.pipelines.getSnapshot();
    const jobId = findFolderDuplicateScanJobId(snapshot, bundleId);
    if (jobId) {
      return jobId;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 30);
    });
  }
  return null;
}

/**
 * Enqueues the folder duplicate-file scan pipeline (progress appears in Background operations).
 */
export async function enqueueFolderDuplicateScan(options: {
  folderPath: string;
  recursive?: boolean;
}): Promise<{ ok: true; bundleId: string; jobId: string | null } | { ok: false; error: string }> {
  const folderPath = options.folderPath.trim();
  if (!folderPath) {
    return { ok: false, error: "Folder path is required." };
  }
  const recursive = options.recursive !== false;

  const result = await window.desktopApi.pipelines.enqueueBundle({
    kind: "single-job",
    payload: {
      pipelineId: "folder-duplicate-scan",
      displayName: `Check duplicate files — ${folderPath}`,
      params: { folderPath, recursive },
    },
  });

  if (!result.ok) {
    return { ok: false, error: rejectionMessage(result) };
  }

  const jobId = await waitForFolderDuplicateScanJobId(result.bundleId);
  return { ok: true, bundleId: result.bundleId, jobId };
}
