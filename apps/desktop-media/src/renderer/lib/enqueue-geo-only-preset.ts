import type { EnqueueBundleResponse } from "../../shared/pipeline-ipc";

function rejectionMessage(result: EnqueueBundleResponse): string {
  if (result.ok) return "";
  const rejection = result.rejection;
  if (rejection.kind === "validation-failed") return rejection.issues;
  if (rejection.kind === "unknown-pipeline") return `Unknown pipeline: ${rejection.pipelineId}`;
  return rejection.reason;
}

/**
 * Enqueues the main-process `geo-only` preset (geocoder-init → gps-geocode) for a folder subtree.
 */
export async function enqueueGeoOnlyPreset(folderPath: string): Promise<void> {
  const trimmed = folderPath.trim();
  if (!trimmed) throw new Error("Folder path is required.");

  const result = await window.desktopApi.pipelines.enqueueBundle({
    kind: "preset",
    payload: {
      presetId: "geo-only",
      args: { folderPath: trimmed, recursive: true },
    },
  });

  if (!result.ok) {
    if (result.rejection.kind === "duplicate-active-job") return;
    throw new Error(rejectionMessage(result) || "Could not start geo-location pipeline.");
  }
}
