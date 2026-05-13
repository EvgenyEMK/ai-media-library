import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

/** Match renderer `comparableFilePath` for stable catalog path keys. */
function comparableFilePath(p: string): string {
  if (!p) {
    return "";
  }
  return p
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function parentFolderComparable(sourcePath: string): string {
  const n = comparableFilePath(sourcePath);
  const i = n.lastIndexOf("/");
  if (i <= 0) {
    return n;
  }
  return n.slice(0, i);
}

/**
 * Counts non-deleted `media_items` whose parent directory (after slash normalization)
 * equals one of the requested folder paths (direct children only, not subtree).
 */
export function getDirectMediaItemCountsByParentFolders(params: {
  folderPaths: string[];
  libraryId?: string;
}): Record<string, number> {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const requested = [
    ...new Set(params.folderPaths.map((p) => comparableFilePath(p.trim())).filter((p) => p.length > 0)),
  ];
  if (requested.length === 0) {
    return {};
  }

  const wantedLower = new Set(requested.map((p) => p.toLowerCase()));
  const countsByLower = new Map<string, number>();
  for (const p of requested) {
    countsByLower.set(p.toLowerCase(), 0);
  }

  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT source_path FROM media_items WHERE library_id = ? AND deleted_at IS NULL`,
    )
    .all(libraryId) as { source_path: string }[];

  for (const row of rows) {
    const parent = parentFolderComparable(row.source_path);
    const key = parent.toLowerCase();
    if (!wantedLower.has(key)) {
      continue;
    }
    countsByLower.set(key, (countsByLower.get(key) ?? 0) + 1);
  }

  const out: Record<string, number> = {};
  for (const original of requested) {
    out[original] = countsByLower.get(original.toLowerCase()) ?? 0;
  }
  return out;
}
