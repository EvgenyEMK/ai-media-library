import type {
  DuplicateMarkedFilesDeleteTarget,
  FolderDuplicateScanRow,
} from "../../shared/ipc";

export type DuplicateDeleteColumn = "scoped" | "dup";

/**
 * Collects delete targets for one duplicate column from the full row list and mark keys.
 */
export function collectDuplicateDeleteTargetsForColumn(
  rows: readonly FolderDuplicateScanRow[],
  markedForDelete: ReadonlySet<string>,
  column: DuplicateDeleteColumn,
): DuplicateMarkedFilesDeleteTarget[] {
  const prefix = column === "scoped" ? "scoped:" : "dup:";
  const out: DuplicateMarkedFilesDeleteTarget[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (column === "scoped") {
      const key = `${prefix}${row.mediaItemId}`;
      if (!markedForDelete.has(key) || seen.has(row.mediaItemId)) {
        continue;
      }
      seen.add(row.mediaItemId);
      out.push({ mediaItemId: row.mediaItemId, sourcePath: row.scopedPath });
      continue;
    }
    for (const d of row.duplicates) {
      const key = `${prefix}${d.mediaItemId}`;
      if (!markedForDelete.has(key) || seen.has(d.mediaItemId)) {
        continue;
      }
      seen.add(d.mediaItemId);
      out.push({ mediaItemId: d.mediaItemId, sourcePath: d.sourcePath });
    }
  }
  return out;
}

export function countDistinctParentFolders(paths: readonly string[]): number {
  const parents = new Set<string>();
  for (const p of paths) {
    const t = p.trim();
    if (!t) {
      continue;
    }
    const norm = t.replace(/\\/g, "/");
    const i = norm.lastIndexOf("/");
    const parent = i >= 0 ? norm.slice(0, i) : "";
    parents.add(parent.length > 0 ? parent : ".");
  }
  return parents.size;
}

export function sumByteSizesForPaths(
  rows: readonly FolderDuplicateScanRow[],
  targets: readonly DuplicateMarkedFilesDeleteTarget[],
): number {
  const want = new Map<string, number | null>();
  for (const t of targets) {
    want.set(t.mediaItemId, null);
  }
  for (const row of rows) {
    if (want.has(row.mediaItemId)) {
      want.set(row.mediaItemId, row.byteSize);
    }
    for (const d of row.duplicates) {
      if (want.has(d.mediaItemId)) {
        want.set(d.mediaItemId, d.byteSize);
      }
    }
  }
  let sum = 0;
  for (const t of targets) {
    const sz = want.get(t.mediaItemId);
    sum += sz != null && Number.isFinite(sz) ? sz : 0;
  }
  return sum;
}
