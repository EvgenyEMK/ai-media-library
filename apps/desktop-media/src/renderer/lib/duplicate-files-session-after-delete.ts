import type { FolderDuplicateScanResultPayload, FolderDuplicateScanRow } from "../../shared/ipc";

/**
 * Removes catalog rows / duplicate entries for media items deleted on disk.
 * Used to refresh the duplicate-files session without re-running the scan.
 */
export function filterDuplicateScanPayloadAfterMediaDeleted(
  payload: FolderDuplicateScanResultPayload,
  deletedMediaItemIds: readonly string[],
): FolderDuplicateScanResultPayload {
  if (deletedMediaItemIds.length === 0) {
    return payload;
  }
  const gone = new Set(deletedMediaItemIds);
  const nextRows: FolderDuplicateScanRow[] = [];

  for (const row of payload.rows) {
    if (gone.has(row.mediaItemId)) {
      continue;
    }
    const nextDups = row.duplicates.filter((d) => !gone.has(d.mediaItemId));
    if (nextDups.length === 0) {
      continue;
    }
    nextRows.push({ ...row, duplicates: nextDups });
  }

  return { ...payload, rows: nextRows };
}
