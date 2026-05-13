import type { FolderDuplicateScanResultPayload } from "../../shared/ipc";
import { isMediaPathInsideSelectionDiskTree } from "./duplicate-files-folder-scope";
import { comparableFilePath } from "./media-metadata-lookup";

/**
 * Scoped catalog rows (under the scan) that have at least one duplicate file path
 * outside the selected folder path on disk (prefix tree).
 */
export function countScopedFilesWithDuplicateOutsideDiskTree(
  payload: FolderDuplicateScanResultPayload,
): number {
  let n = 0;
  for (const row of payload.rows) {
    if (
      row.duplicates.some((d) => !isMediaPathInsideSelectionDiskTree(d.sourcePath, payload.folderPath))
    ) {
      n += 1;
    }
  }
  return n;
}

/**
 * Sum of byte sizes for distinct duplicate paths outside the selection disk tree
 * (each path counted once).
 */
export function totalByteSizeOfDuplicatesOutsideDiskTree(payload: FolderDuplicateScanResultPayload): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const row of payload.rows) {
    for (const d of row.duplicates) {
      if (isMediaPathInsideSelectionDiskTree(d.sourcePath, payload.folderPath)) {
        continue;
      }
      const k = comparableFilePath(d.sourcePath).toLowerCase();
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      sum += d.byteSize ?? 0;
    }
  }
  return sum;
}

/**
 * Scoped catalog rows that have at least one duplicate path inside the selection disk tree.
 */
export function countScopedFilesWithDuplicateInsideDiskTree(
  payload: FolderDuplicateScanResultPayload,
): number {
  let n = 0;
  for (const row of payload.rows) {
    if (row.duplicates.some((d) => isMediaPathInsideSelectionDiskTree(d.sourcePath, payload.folderPath))) {
      n += 1;
    }
  }
  return n;
}

/**
 * Sum of byte sizes for distinct duplicate paths inside the selection disk tree.
 */
export function totalByteSizeOfDuplicatesInsideDiskTree(payload: FolderDuplicateScanResultPayload): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const row of payload.rows) {
    for (const d of row.duplicates) {
      if (!isMediaPathInsideSelectionDiskTree(d.sourcePath, payload.folderPath)) {
        continue;
      }
      const k = comparableFilePath(d.sourcePath).toLowerCase();
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      sum += d.byteSize ?? 0;
    }
  }
  return sum;
}
