import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { isMediaPathInFolderScope, scopeLikePatterns } from "../lib/folder-duplicate-scan-scope";

/**
 * Counts catalog media rows under `folderPath` using the same scope rules as
 * `folder-duplicate-scan` (direct children vs recursive subtree).
 */
export function countMediaItemsInFolderScope(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
}): number {
  const folderPath = params.folderPath.trim();
  if (!folderPath) {
    return 0;
  }
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const { exact, like } = scopeLikePatterns(folderPath);
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT source_path FROM media_items
       WHERE library_id = ? AND deleted_at IS NULL
         AND (source_path = ? OR source_path LIKE ? ESCAPE '~')`,
    )
    .all(libraryId, exact, like) as { source_path: string }[];

  return rows.filter((r) => isMediaPathInFolderScope(r.source_path, exact, params.recursive)).length;
}
