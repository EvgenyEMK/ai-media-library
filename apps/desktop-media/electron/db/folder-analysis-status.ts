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
