import type {
  FolderDuplicateScanResultPayload,
  FolderDuplicateScanRow,
} from "../../shared/ipc";
import { comparableFilePath } from "./media-metadata-lookup";
import {
  isMediaPathInFolderScope,
  isMediaPathInsideSelectionDiskTree,
  normalizedScanRoot,
  parentFolderPath,
} from "./duplicate-files-folder-scope";

export interface DuplicateFolderSummary {
  /** Normalized directory path containing at least one duplicate file (from the duplicate column). */
  folderPath: string;
  /** Distinct duplicate file paths in this folder. */
  duplicatePathCount: number;
  /** Sum of `byte_size` for distinct duplicate paths in this folder (one size per path). */
  duplicateBytesTotal: number;
  /** Duplicate paths that lie inside the scanned folder scope. */
  inSelectionCount: number;
  /** Duplicate paths that lie outside the scanned folder scope. */
  outsideSelectionCount: number;
}

/**
 * Groups distinct paths from the duplicate column by parent folder; sorts by total duplicate count descending.
 */
export function buildDuplicateFolderSummaries(payload: FolderDuplicateScanResultPayload): DuplicateFolderSummary[] {
  const scanRoot = normalizedScanRoot(payload.folderPath);
  const recursive = payload.recursive;

  const folderToPathBytes = new Map<string, Map<string, number>>();

  for (const row of payload.rows) {
    for (const dup of row.duplicates) {
      const folderKey = parentFolderPath(dup.sourcePath);
      const pathKey = comparableFilePath(dup.sourcePath);
      let pathBytes = folderToPathBytes.get(folderKey);
      if (!pathBytes) {
        pathBytes = new Map<string, number>();
        folderToPathBytes.set(folderKey, pathBytes);
      }
      if (!pathBytes.has(pathKey)) {
        pathBytes.set(pathKey, dup.byteSize ?? 0);
      }
    }
  }

  const summaries: DuplicateFolderSummary[] = [];

  for (const [folderPath, pathBytes] of folderToPathBytes) {
    let duplicateBytesTotal = 0;
    const paths = new Set<string>(pathBytes.keys());
    for (const sz of pathBytes.values()) {
      duplicateBytesTotal += sz;
    }
    let inSelectionCount = 0;
    let outsideSelectionCount = 0;
    for (const p of paths) {
      if (isMediaPathInFolderScope(p, scanRoot, recursive)) {
        inSelectionCount += 1;
      } else {
        outsideSelectionCount += 1;
      }
    }
    summaries.push({
      folderPath,
      duplicatePathCount: paths.size,
      duplicateBytesTotal,
      inSelectionCount,
      outsideSelectionCount,
    });
  }

  summaries.sort((a, b) => {
    if (b.duplicatePathCount !== a.duplicatePathCount) {
      return b.duplicatePathCount - a.duplicatePathCount;
    }
    return a.folderPath.localeCompare(b.folderPath);
  });

  return summaries;
}

/**
 * Splits folder rows by whether the duplicate parent directory lies under the
 * selected folder path on disk (prefix), independent of recursive scan scope.
 */
export function splitDuplicateFolderSummariesBySelectionDiskTree(
  summaries: DuplicateFolderSummary[],
  selectionFolderPath: string,
): { outside: DuplicateFolderSummary[]; inside: DuplicateFolderSummary[] } {
  const outside: DuplicateFolderSummary[] = [];
  const inside: DuplicateFolderSummary[] = [];
  for (const s of summaries) {
    const insideTree = isMediaPathInsideSelectionDiskTree(s.folderPath, selectionFolderPath);
    (insideTree ? inside : outside).push(s);
  }

  const cmp = (a: DuplicateFolderSummary, b: DuplicateFolderSummary): number => {
    if (b.duplicatePathCount !== a.duplicatePathCount) {
      return b.duplicatePathCount - a.duplicatePathCount;
    }
    return a.folderPath.localeCompare(b.folderPath);
  };
  outside.sort(cmp);
  inside.sort(cmp);
  return { outside, inside };
}

export function totalDuplicatePathsInSummaries(summaries: DuplicateFolderSummary[]): number {
  let n = 0;
  for (const s of summaries) {
    n += s.duplicatePathCount;
  }
  return n;
}

/**
 * Rows where a scoped file or any duplicate lies directly in `filterFolder` (normalized dir match).
 */
export function rowMatchesFolderFilter(row: FolderDuplicateScanRow, filterFolder: string): boolean {
  const f = comparableFilePath(filterFolder.trim()).toLowerCase();
  const scopedDir = parentFolderPath(row.scopedPath).toLowerCase();
  if (scopedDir === f) {
    return true;
  }
  return row.duplicates.some((d) => parentFolderPath(d.sourcePath).toLowerCase() === f);
}
