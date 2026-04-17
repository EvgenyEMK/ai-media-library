import path from "node:path";
import type { FolderAnalysisStatus } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";

export const DEFAULT_LIBRARY_ID = "local-default";

export type AnalysisKind = "photo" | "face" | "semantic";

export function getFolderAnalysisStatuses(
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, FolderAnalysisStatus> {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT
         folder_path,
         photo_in_progress,
         face_in_progress,
         semantic_in_progress,
         photo_analyzed_at,
         face_analyzed_at,
         semantic_indexed_at,
         last_updated_at
       FROM folder_analysis_status
       WHERE library_id = ?`,
    )
    .all(libraryId) as Array<{
    folder_path: string;
    photo_in_progress: number;
    face_in_progress: number;
    semantic_in_progress: number;
    photo_analyzed_at: string | null;
    face_analyzed_at: string | null;
    semantic_indexed_at: string | null;
    last_updated_at: string;
  }>;

  return rows.reduce<Record<string, FolderAnalysisStatus>>((acc, row) => {
    const isInProgress =
      row.photo_in_progress === 1 || row.face_in_progress === 1 || row.semantic_in_progress === 1;
    const hasCompletion = Boolean(
      row.photo_analyzed_at || row.face_analyzed_at || row.semantic_indexed_at,
    );
    acc[row.folder_path] = {
      state: isInProgress ? "in_progress" : hasCompletion ? "analyzed" : "not_scanned",
      photoAnalyzedAt: row.photo_analyzed_at,
      faceAnalyzedAt: row.face_analyzed_at,
      semanticIndexedAt: row.semantic_indexed_at,
      lastUpdatedAt: row.last_updated_at,
    };
    return acc;
  }, {});
}

export function setFolderAnalysisInProgress(
  folderPath: string,
  kind: AnalysisKind,
  inProgress: boolean,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  ensureRow(db, libraryId, folderPath);
  const now = new Date().toISOString();
  const column =
    kind === "photo" ? "photo_in_progress" : kind === "face" ? "face_in_progress" : "semantic_in_progress";
  db.prepare(
    `UPDATE folder_analysis_status
     SET ${column} = ?, last_updated_at = ?
     WHERE library_id = ? AND folder_path = ?`,
  ).run(inProgress ? 1 : 0, now, libraryId, folderPath);
}

export function markFolderAnalyzed(
  folderPath: string,
  kind: "photo" | "face",
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  ensureRow(db, libraryId, folderPath);
  const now = new Date().toISOString();
  const analyzedAtColumn = kind === "photo" ? "photo_analyzed_at" : "face_analyzed_at";
  db.prepare(
    `UPDATE folder_analysis_status
     SET ${analyzedAtColumn} = ?, last_updated_at = ?
     WHERE library_id = ? AND folder_path = ?`,
  ).run(now, now, libraryId, folderPath);
}

export function markFolderSemanticIndexed(folderPath: string, libraryId = DEFAULT_LIBRARY_ID): void {
  const db = getDesktopDatabase();
  ensureRow(db, libraryId, folderPath);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE folder_analysis_status
     SET semantic_indexed_at = ?, last_updated_at = ?
     WHERE library_id = ? AND folder_path = ?`,
  ).run(now, now, libraryId, folderPath);
}

export function clearAllInProgressFlags(libraryId = DEFAULT_LIBRARY_ID): number {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE folder_analysis_status
     SET photo_in_progress = 0,
         face_in_progress = 0,
         semantic_in_progress = 0,
         last_updated_at = ?
     WHERE library_id = ?
       AND (photo_in_progress = 1 OR face_in_progress = 1 OR semantic_in_progress = 1)`,
  ).run(now, libraryId);
  return result.changes;
}

export function pruneFolderAnalysisStatusesNotInSet(
  rootPath: string,
  keepPaths: Iterable<string>,
  libraryId = DEFAULT_LIBRARY_ID,
): number {
  const normalizedRoot = normalizeFolderPath(rootPath);
  if (!normalizedRoot) return 0;

  const keep = new Set<string>();
  for (const candidate of keepPaths) {
    const normalized = normalizeFolderPath(candidate);
    if (normalized) {
      keep.add(normalized);
    }
  }
  keep.add(normalizedRoot);

  const db = getDesktopDatabase();
  const prefixes = buildScopePatterns(normalizedRoot);
  const rows = db.prepare(
    `SELECT folder_path
     FROM folder_analysis_status
     WHERE library_id = ?
       AND (folder_path = ? OR folder_path LIKE ?)`,
  ).all(libraryId, prefixes.exact, prefixes.like) as Array<{ folder_path: string }>;

  const now = new Date().toISOString();
  const deleteStmt = db.prepare(
    `DELETE FROM folder_analysis_status
     WHERE library_id = ? AND folder_path = ?`,
  );

  let deleted = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const normalized = normalizeFolderPath(row.folder_path);
      if (!normalized || keep.has(normalized)) continue;
      const result = deleteStmt.run(libraryId, row.folder_path);
      deleted += result.changes;
    }
  });
  tx();

  if (deleted > 0) {
    db.prepare(
      `UPDATE folder_analysis_status
       SET last_updated_at = ?
       WHERE library_id = ? AND folder_path = ?`,
    ).run(now, libraryId, normalizedRoot);
  }

  return deleted;
}

export function pruneFolderAnalysisStatusesForMissingChildren(
  parentPath: string,
  existingChildren: Iterable<string>,
  libraryId = DEFAULT_LIBRARY_ID,
): number {
  const normalizedParent = normalizeFolderPath(parentPath);
  if (!normalizedParent) return 0;

  const keepChildRoots = new Set<string>();
  for (const childPath of existingChildren) {
    const normalized = normalizeFolderPath(childPath);
    if (!normalized) continue;
    const rel = path.relative(normalizedParent, normalized);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    const directChild = rel.split(path.sep)[0];
    if (directChild) keepChildRoots.add(directChild);
  }

  const db = getDesktopDatabase();
  const prefixes = buildScopePatterns(normalizedParent);
  const rows = db.prepare(
    `SELECT folder_path
     FROM folder_analysis_status
     WHERE library_id = ?
       AND (folder_path = ? OR folder_path LIKE ?)`,
  ).all(libraryId, prefixes.exact, prefixes.like) as Array<{ folder_path: string }>;

  const deleteStmt = db.prepare(
    `DELETE FROM folder_analysis_status
     WHERE library_id = ? AND folder_path = ?`,
  );

  let deleted = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const normalized = normalizeFolderPath(row.folder_path);
      if (!normalized || normalized === normalizedParent) continue;
      const rel = path.relative(normalizedParent, normalized);
      if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
      const directChild = rel.split(path.sep)[0];
      if (!directChild || keepChildRoots.has(directChild)) continue;
      const result = deleteStmt.run(libraryId, row.folder_path);
      deleted += result.changes;
    }
  });
  tx();

  return deleted;
}

function normalizeFolderPath(folderPath: string): string {
  const trimmed = folderPath?.trim();
  if (!trimmed) return "";
  return path.normalize(trimmed);
}

function buildScopePatterns(rootPath: string): { exact: string; like: string } {
  const exact = rootPath;
  const withSep = rootPath.endsWith(path.sep) ? rootPath : `${rootPath}${path.sep}`;
  return {
    exact,
    like: `${withSep}%`,
  };
}

function ensureRow(db: ReturnType<typeof getDesktopDatabase>, libraryId: string, folderPath: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO folder_analysis_status (
      library_id,
      folder_path,
      photo_in_progress,
      face_in_progress,
      semantic_in_progress,
      photo_analyzed_at,
      face_analyzed_at,
      semantic_indexed_at,
      last_updated_at
    ) VALUES (?, ?, 0, 0, 0, NULL, NULL, NULL, ?)
    ON CONFLICT(library_id, folder_path) DO NOTHING`,
  ).run(libraryId, folderPath, now);
}
