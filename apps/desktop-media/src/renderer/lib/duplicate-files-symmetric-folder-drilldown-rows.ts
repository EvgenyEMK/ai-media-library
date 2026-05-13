import type { FolderDuplicateScanRow } from "../../shared/ipc";
import { comparableFilePath } from "./media-metadata-lookup";
import { parentFolderPath } from "./duplicate-files-folder-scope";

function scopedParentDirLower(row: FolderDuplicateScanRow): string {
  return parentFolderPath(row.scopedPath).toLowerCase();
}

function filterFolderComparableLower(filterFolder: string): string {
  return comparableFilePath(filterFolder.trim()).toLowerCase();
}

function isMutualSingletonDuplicatePair(a: FolderDuplicateScanRow, b: FolderDuplicateScanRow): boolean {
  if (a.duplicates.length !== 1 || b.duplicates.length !== 1) {
    return false;
  }
  if (a.mediaItemId === b.mediaItemId) {
    return false;
  }
  const da = a.duplicates[0]!;
  const db = b.duplicates[0]!;
  return (
    comparableFilePath(a.scopedPath).toLowerCase() === comparableFilePath(db.sourcePath).toLowerCase() &&
    comparableFilePath(b.scopedPath).toLowerCase() === comparableFilePath(da.sourcePath).toLowerCase()
  );
}

/**
 * When drilling into a folder from the duplicate-folder overview, the scan payload can contain
 * two rows for the same mutual duplicate pair (scoped A → dup B and scoped B → dup A). The folder
 * overview counts each on-disk duplicate path once; this collapses matching pairs to one row so
 * the "By file" list length matches that mental model.
 */
export function dedupeMutualSingletonDuplicateRowsForFolderFilter(
  rows: FolderDuplicateScanRow[],
  filterFolder: string,
): FolderDuplicateScanRow[] {
  if (rows.length <= 1) {
    return rows;
  }

  const fLower = filterFolderComparableLower(filterFolder);
  const scopedInFilterFolder = (r: FolderDuplicateScanRow): boolean => scopedParentDirLower(r) === fLower;

  const byScopedComparableLower = new Map<string, FolderDuplicateScanRow>();
  for (const r of rows) {
    byScopedComparableLower.set(comparableFilePath(r.scopedPath).toLowerCase(), r);
  }

  const consumed = new Set<string>();
  const out: FolderDuplicateScanRow[] = [];
  const sorted = [...rows].sort((a, b) => a.mediaItemId.localeCompare(b.mediaItemId));

  for (const row of sorted) {
    if (consumed.has(row.mediaItemId)) {
      continue;
    }

    if (row.duplicates.length !== 1) {
      out.push(row);
      consumed.add(row.mediaItemId);
      continue;
    }

    const dupPathLower = comparableFilePath(row.duplicates[0]!.sourcePath).toLowerCase();
    const partner = byScopedComparableLower.get(dupPathLower);

    if (partner && isMutualSingletonDuplicatePair(row, partner)) {
      let keeper: FolderDuplicateScanRow;
      const rowIn = scopedInFilterFolder(row);
      const partnerIn = scopedInFilterFolder(partner);
      if (rowIn && !partnerIn) {
        keeper = row;
      } else if (!rowIn && partnerIn) {
        keeper = partner;
      } else {
        keeper = row.mediaItemId.localeCompare(partner.mediaItemId) <= 0 ? row : partner;
      }
      out.push(keeper);
      consumed.add(row.mediaItemId);
      consumed.add(partner.mediaItemId);
    } else {
      out.push(row);
      consumed.add(row.mediaItemId);
    }
  }

  return out;
}
