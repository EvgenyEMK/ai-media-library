import type { DuplicateMarkedFilesDeleteJobResult } from "../../shared/ipc";

export function parseDuplicateMarkedFilesDeleteJobOutput(raw: unknown): DuplicateMarkedFilesDeleteJobResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.deletedMediaItemIds) || !Array.isArray(o.failed)) {
    return null;
  }
  const deletedMediaItemIds = o.deletedMediaItemIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  const failed: DuplicateMarkedFilesDeleteJobResult["failed"] = [];
  for (const item of o.failed) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const r = item as Record<string, unknown>;
    const mediaItemId = typeof r.mediaItemId === "string" ? r.mediaItemId : "";
    const sourcePath = typeof r.sourcePath === "string" ? r.sourcePath : "";
    const error = typeof r.error === "string" ? r.error : "";
    if (mediaItemId && sourcePath) {
      failed.push({ mediaItemId, sourcePath, error: error.length > 0 ? error : "Unknown error" });
    }
  }
  return { deletedMediaItemIds, failed };
}
