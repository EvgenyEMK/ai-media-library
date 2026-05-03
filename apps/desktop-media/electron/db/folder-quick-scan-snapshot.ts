import path from "node:path";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { folderPathMatchesStored } from "./folder-path-matching";

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

function scopeLikePatterns(rootPath: string): { exact: string; like: string } {
  const normalized = path.normalize(rootPath.trim());
  const sep = normalized.includes("\\") ? "\\" : "/";
  const withSep = normalized.endsWith(sep) ? normalized : `${normalized}${sep}`;
  return {
    exact: normalized,
    like: `${escapeLikePattern(withSep)}%`,
  };
}

export function countQuickScanSnapshotsUnderRoot(
  rootPath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): number {
  const normalized = path.normalize(rootPath.trim());
  if (!normalized) return 0;
  const { exact, like } = scopeLikePatterns(normalized);
  const row = getDesktopDatabase()
    .prepare(
      `SELECT COUNT(*) AS c
       FROM folder_quick_scan_snapshot
       WHERE library_id = ?
         AND (folder_path = ? OR folder_path LIKE ? ESCAPE '~')`,
    )
    .get(libraryId, exact, like) as { c: number } | undefined;
  return Number(row?.c ?? 0);
}

export function getDirMtimeSnapshotsForPaths(
  folderPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Map<string, number> {
  const normalized = Array.from(
    new Set(folderPaths.map((p) => path.normalize(p.trim())).filter(Boolean)),
  );
  const out = new Map<string, number>();
  if (normalized.length === 0) return out;

  const db = getDesktopDatabase();
  const rows =
    process.platform === "win32"
      ? (db
          .prepare(
            `SELECT folder_path, dir_mtime_ms
             FROM folder_quick_scan_snapshot
             WHERE library_id = ?
               AND folder_path COLLATE NOCASE IN (${normalized.map(() => "?").join(", ")})`,
          )
          .all(libraryId, ...normalized) as Array<{
          folder_path: string;
          dir_mtime_ms: number;
        }>)
      : (db
          .prepare(
            `SELECT folder_path, dir_mtime_ms
             FROM folder_quick_scan_snapshot
             WHERE library_id = ? AND folder_path IN (${normalized.map(() => "?").join(", ")})`,
          )
          .all(libraryId, ...normalized) as Array<{
          folder_path: string;
          dir_mtime_ms: number;
        }>);

  for (const fp of normalized) {
    const hit = rows.find((row) => folderPathMatchesStored(row.folder_path, fp));
    if (hit) {
      out.set(fp, hit.dir_mtime_ms);
    }
  }
  return out;
}

export function upsertQuickScanSnapshots(
  entries: Array<{
    folderPath: string;
    dirMtimeMs: number;
    subdirNamesSig: string;
    mediaFilesSig: string;
  }>,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  const db = getDesktopDatabase();
  const stmt = db.prepare(
    `INSERT INTO folder_quick_scan_snapshot (
      library_id, folder_path, dir_mtime_ms, subdir_names_sig, media_files_sig, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, folder_path) DO UPDATE SET
      dir_mtime_ms = excluded.dir_mtime_ms,
      subdir_names_sig = excluded.subdir_names_sig,
      media_files_sig = excluded.media_files_sig,
      updated_at = excluded.updated_at`,
  );
  const tx = db.transaction(() => {
    for (const e of entries) {
      const fp = path.normalize(e.folderPath.trim());
      if (!fp) continue;
      stmt.run(libraryId, fp, e.dirMtimeMs, e.subdirNamesSig, e.mediaFilesSig, now);
    }
  });
  tx();
}
