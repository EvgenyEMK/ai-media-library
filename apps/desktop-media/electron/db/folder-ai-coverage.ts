import path from "node:path";
import type {
  FolderAiCoverageReport,
  FolderAiPipelineCounts,
  FolderAiPipelineLabel,
  FolderAiSidebarRollup,
} from "../../src/shared/ipc";
import { IMAGE_EXTENSIONS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { MULTIMODAL_EMBED_MODEL } from "../semantic-embeddings";

export type { FolderAiCoverageReport } from "../../src/shared/ipc";

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

function buildImageFilePredicate(): string {
  const extClauses = [...IMAGE_EXTENSIONS].map((ext) => {
    const pat = `%${ext}`.replace(/'/g, "''");
    return `lower(mi.filename) LIKE '${pat}'`;
  });
  return `(mi.mime_type LIKE 'image/%' OR ${extClauses.join(" OR ")})`;
}

function pipelineLabel(done: number, total: number): FolderAiPipelineLabel {
  if (total === 0) return "empty";
  if (done === 0) return "not_done";
  if (done === total) return "done";
  return "partial";
}

function toPipelineCounts(done: number, failed: number, total: number): FolderAiPipelineCounts {
  return {
    doneCount: done,
    failedCount: failed,
    totalImages: total,
    label: pipelineLabel(done, total),
  };
}

/**
 * Aggregates AI pipeline completion for image media_items under a folder.
 * Non-recursive: only files whose dirname equals folderPath (direct images only).
 */
export function getFolderAiCoverage(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
  semanticModelVersion?: string;
}): FolderAiCoverageReport {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const modelVersion = params.semanticModelVersion ?? MULTIMODAL_EMBED_MODEL;
  const folderPath = params.folderPath?.trim();
  if (!folderPath) {
    return emptyReport("", params.recursive);
  }

  const sep = path.sep;
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;
  const likePattern = `${escapeLikePattern(folderPrefix)}%`;
  const imagePred = buildImageFilePredicate();

  const depthClause = params.recursive
    ? ""
    : `AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;

  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN mi.photo_analysis_processed_at IS NOT NULL THEN 1 ELSE 0 END) AS photo_done,
      SUM(CASE WHEN mi.face_detection_processed_at IS NOT NULL THEN 1 ELSE 0 END) AS face_done,
      SUM(
        CASE
          WHEN EXISTS (
            SELECT 1 FROM media_embeddings me
            WHERE me.media_item_id = mi.id
              AND me.library_id = mi.library_id
              AND me.embedding_type = 'image'
              AND me.model_version = ?
              AND me.embedding_status = 'ready'
          )
          THEN 1 ELSE 0 END
      ) AS semantic_done,
      SUM(CASE WHEN mi.photo_analysis_failed_at IS NOT NULL AND mi.photo_analysis_processed_at IS NULL THEN 1 ELSE 0 END) AS photo_failed,
      SUM(CASE WHEN mi.face_detection_failed_at IS NOT NULL AND mi.face_detection_processed_at IS NULL THEN 1 ELSE 0 END) AS face_failed,
      SUM(
        CASE
          WHEN EXISTS (
            SELECT 1 FROM media_embeddings me
            WHERE me.media_item_id = mi.id
              AND me.library_id = mi.library_id
              AND me.embedding_type = 'image'
              AND me.model_version = ?
              AND me.embedding_status = 'failed'
          )
          THEN 1 ELSE 0 END
      ) AS semantic_failed
    FROM media_items mi
    WHERE mi.library_id = ?
      AND mi.deleted_at IS NULL
      AND ${imagePred}
      AND mi.source_path LIKE ? ESCAPE '~'
      ${depthClause}
  `;

  const db = getDesktopDatabase();
  const stmt = db.prepare(sql);
  const bindRecursive: unknown[] = [modelVersion, modelVersion, libraryId, likePattern];
  if (!params.recursive) {
    bindRecursive.push(folderPrefix, sep);
  }

  const row = stmt.get(...bindRecursive) as {
    total: number | null;
    photo_done: number | null;
    face_done: number | null;
    semantic_done: number | null;
    photo_failed: number | null;
    face_failed: number | null;
    semantic_failed: number | null;
  };

  const total = Number(row?.total ?? 0);
  const photoDone = Number(row?.photo_done ?? 0);
  const faceDone = Number(row?.face_done ?? 0);
  const semanticDone = Number(row?.semantic_done ?? 0);
  const photoFailed = Number(row?.photo_failed ?? 0);
  const faceFailed = Number(row?.face_failed ?? 0);
  const semanticFailed = Number(row?.semantic_failed ?? 0);

  return {
    folderPath,
    recursive: params.recursive,
    totalImages: total,
    photo: toPipelineCounts(photoDone, photoFailed, total),
    face: toPipelineCounts(faceDone, faceFailed, total),
    semantic: toPipelineCounts(semanticDone, semanticFailed, total),
  };
}

function emptyReport(folderPath: string, recursive: boolean): FolderAiCoverageReport {
  return {
    folderPath,
    recursive,
    totalImages: 0,
    photo: toPipelineCounts(0, 0, 0),
    face: toPipelineCounts(0, 0, 0),
    semantic: toPipelineCounts(0, 0, 0),
  };
}

export function folderCoverageToSidebarRollup(coverage: FolderAiCoverageReport): FolderAiSidebarRollup {
  if (coverage.totalImages === 0) return "empty";
  const { photo, face, semantic } = coverage;
  if (photo.label === "done" && face.label === "done" && semantic.label === "done") {
    return "all_done";
  }
  if (photo.label === "partial" || face.label === "partial" || semantic.label === "partial") {
    return "partial";
  }
  if (photo.label === "not_done" || face.label === "not_done" || semantic.label === "not_done") {
    return "not_done";
  }
  return "all_done";
}

export function getFolderAiRollupsForPaths(
  folderPaths: string[],
  libraryId?: string,
): Record<string, FolderAiSidebarRollup> {
  const resolvedLibraryId = libraryId ?? DEFAULT_LIBRARY_ID;
  const modelVersion = MULTIMODAL_EMBED_MODEL;
  const sep = path.sep;
  const imagePred = buildImageFilePredicate();

  const trimmedPaths = folderPaths
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));

  if (trimmedPaths.length === 0) return {};

  const db = getDesktopDatabase();

  const prefixes = trimmedPaths.map((p) =>
    p.endsWith(sep) ? p : `${p}${sep}`,
  );

  // Build a VALUES table of (folder_idx, like_pattern) for a single batched query.
  // Each media_item is joined to every folder prefix it matches, so nested folders
  // (recursive rollups) count correctly.
  // Use AS fp only: SQLite does not support AS fp(col1, col2) on VALUES; columns are column1, column2.
  const valuesRows = prefixes.map(
    (prefix, i) =>
      `(${i}, '${escapeLikePattern(prefix).replace(/'/g, "''")}%')`,
  );

  const sql = `
    SELECT
      fp.column1 AS folder_idx,
      COUNT(*) AS total,
      SUM(CASE WHEN mi.photo_analysis_processed_at IS NOT NULL THEN 1 ELSE 0 END) AS photo_done,
      SUM(CASE WHEN mi.face_detection_processed_at IS NOT NULL THEN 1 ELSE 0 END) AS face_done,
      SUM(
        CASE
          WHEN EXISTS (
            SELECT 1 FROM media_embeddings me
            WHERE me.media_item_id = mi.id
              AND me.library_id = mi.library_id
              AND me.embedding_type = 'image'
              AND me.model_version = ?
              AND me.embedding_status = 'ready'
          )
          THEN 1 ELSE 0 END
      ) AS semantic_done
    FROM (VALUES ${valuesRows.join(", ")}) AS fp
    JOIN media_items mi
      ON mi.source_path LIKE fp.column2 ESCAPE '~'
    WHERE mi.library_id = ?
      AND mi.deleted_at IS NULL
      AND ${imagePred}
    GROUP BY fp.column1
  `;

  const stmt = db.prepare(sql);
  const rows = stmt.all(modelVersion, resolvedLibraryId) as Array<{
    folder_idx: number;
    total: number | null;
    photo_done: number | null;
    face_done: number | null;
    semantic_done: number | null;
  }>;

  const out: Record<string, FolderAiSidebarRollup> = {};
  const rowByIdx = new Map(rows.map((r) => [r.folder_idx, r]));

  for (let i = 0; i < trimmedPaths.length; i++) {
    const row = rowByIdx.get(i);
    const total = Number(row?.total ?? 0);
    const photoDone = Number(row?.photo_done ?? 0);
    const faceDone = Number(row?.face_done ?? 0);
    const semanticDone = Number(row?.semantic_done ?? 0);

    const cov: FolderAiCoverageReport = {
      folderPath: trimmedPaths[i],
      recursive: true,
      totalImages: total,
      photo: toPipelineCounts(photoDone, 0, total),
      face: toPipelineCounts(faceDone, 0, total),
      semantic: toPipelineCounts(semanticDone, 0, total),
    };
    out[trimmedPaths[i]] = folderCoverageToSidebarRollup(cov);
  }

  return out;
}
