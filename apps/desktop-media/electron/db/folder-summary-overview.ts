import path from "node:path";
import type { FolderAiSummaryOverview } from "../../src/shared/ipc";
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { folderPathMatchesStored } from "./folder-path-matching";

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

function separatorForFolderPath(folderPath: string): string {
  if (folderPath.includes("\\")) return "\\";
  if (folderPath.includes("/")) return "/";
  return path.sep;
}

function normalizeFolderLookupKey(folderPath: string): string {
  return path.normalize(folderPath.trim());
}

function extensionPredicate(alias: string, extensions: Set<string>): string {
  const extClauses = [...extensions].map((ext) => {
    const pat = `%${ext}`.replace(/'/g, "''");
    return `lower(${alias}.filename) LIKE '${pat}'`;
  });
  return `(${extClauses.join(" OR ")})`;
}

function mediaKindPredicate(kind: "image" | "video"): string {
  const mimePrefix = kind === "image" ? "image/%" : "video/%";
  const extensions = kind === "image" ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
  return `(mi.media_kind = '${kind}' OR mi.mime_type LIKE '${mimePrefix}' OR ${extensionPredicate("mi", extensions)})`;
}

function emptyOverview(folderPath: string, recursive: boolean): FolderAiSummaryOverview {
  return {
    folderPath,
    recursive,
    totalImages: 0,
    totalVideos: 0,
    scanFreshness: {
      lastMetadataScanCompletedAt: null,
      oldestFolderScanCompletedAt: null,
      oldestMetadataExtractedAt: null,
      lastMetadataExtractedAt: null,
      scannedCount: 0,
      unscannedCount: 0,
      totalMedia: 0,
      folderTreeQuickScan: null,
    },
  };
}

export function getFolderSummaryOverview(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
}): FolderAiSummaryOverview {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const folderPath = params.folderPath?.trim();
  if (!folderPath) return emptyOverview("", params.recursive);

  const sep = separatorForFolderPath(folderPath);
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;
  const likePattern = `${escapeLikePattern(folderPrefix)}%`;
  const imagePred = mediaKindPredicate("image");
  const videoPred = mediaKindPredicate("video");
  const depthClause = params.recursive
    ? ""
    : `AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;
  const folderScanScopeClause = params.recursive
    ? "(fas.folder_path = ? OR fas.folder_path LIKE ? ESCAPE '~')"
    : "fas.folder_path = ?";

  const sql = `
    SELECT
      SUM(CASE WHEN ${imagePred} THEN 1 ELSE 0 END) AS total_images,
      SUM(CASE WHEN ${videoPred} THEN 1 ELSE 0 END) AS total_videos,
      SUM(CASE WHEN mi.metadata_extracted_at IS NOT NULL THEN 1 ELSE 0 END) AS scanned_count,
      SUM(CASE WHEN mi.metadata_extracted_at IS NULL THEN 1 ELSE 0 END) AS unscanned_count,
      MIN(mi.metadata_extracted_at) AS oldest_metadata_extracted_at,
      MAX(mi.file_mtime_ms) AS last_file_mtime_ms,
      (
        SELECT metadata_scanned_at
        FROM folder_analysis_status fas
        WHERE fas.library_id = ?
          AND fas.folder_path = ?
      ) AS last_metadata_scan_completed_at,
      (
        SELECT MIN(fas.metadata_scanned_at)
        FROM folder_analysis_status fas
        WHERE fas.library_id = ?
          AND fas.metadata_scanned_at IS NOT NULL
          AND ${folderScanScopeClause}
      ) AS oldest_folder_scan_completed_at
    FROM media_items mi
    WHERE mi.library_id = ?
      AND mi.deleted_at IS NULL
      AND (${imagePred} OR ${videoPred})
      AND mi.source_path LIKE ? ESCAPE '~'
      ${depthClause}
  `;

  const bindValues: unknown[] = [libraryId, folderPath, libraryId];
  if (params.recursive) {
    bindValues.push(folderPath, likePattern);
  } else {
    bindValues.push(folderPath);
  }
  bindValues.push(libraryId, likePattern);
  if (!params.recursive) {
    bindValues.push(folderPrefix, sep);
  }

  const row = getDesktopDatabase().prepare(sql).get(...bindValues) as {
    total_images: number | null;
    total_videos: number | null;
    scanned_count: number | null;
    unscanned_count: number | null;
    oldest_metadata_extracted_at: string | null;
    last_file_mtime_ms: number | null;
    last_metadata_scan_completed_at: string | null;
    oldest_folder_scan_completed_at: string | null;
  };

  const totalImages = Number(row?.total_images ?? 0);
  const totalVideos = Number(row?.total_videos ?? 0);
  const scannedCount = Number(row?.scanned_count ?? 0);
  const unscannedCount = Number(row?.unscanned_count ?? 0);

  return {
    folderPath,
    recursive: params.recursive,
    totalImages,
    totalVideos,
    scanFreshness: {
      lastMetadataScanCompletedAt: row?.last_metadata_scan_completed_at ?? null,
      oldestFolderScanCompletedAt: row?.oldest_folder_scan_completed_at ?? row?.last_metadata_scan_completed_at ?? null,
      oldestMetadataExtractedAt: row?.oldest_metadata_extracted_at ?? null,
      lastMetadataExtractedAt: row?.last_file_mtime_ms ? new Date(row.last_file_mtime_ms).toISOString() : null,
      scannedCount,
      unscannedCount,
      totalMedia: scannedCount + unscannedCount,
      folderTreeQuickScan: null,
    },
  };
}

export function getFolderScanAgeSummary(params: {
  folderPath: string;
  olderThanIso: string;
  libraryId?: string;
}): {
  outdatedScannedFolderCount: number;
  scannedFolderCount: number;
} {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const folderPath = params.folderPath?.trim();
  if (!folderPath) return { outdatedScannedFolderCount: 0, scannedFolderCount: 0 };

  const sep = separatorForFolderPath(folderPath);
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;
  const likePattern = `${escapeLikePattern(folderPrefix)}%`;
  const row = getDesktopDatabase()
    .prepare(
      `SELECT
         COUNT(*) AS scanned_folder_count,
         SUM(CASE WHEN metadata_scanned_at < ? THEN 1 ELSE 0 END) AS outdated_scanned_folder_count
       FROM folder_analysis_status
       WHERE library_id = ?
         AND metadata_scanned_at IS NOT NULL
         AND (folder_path = ? OR folder_path LIKE ? ESCAPE '~')`,
    )
    .get(params.olderThanIso, libraryId, folderPath, likePattern) as {
    scanned_folder_count: number | null;
    outdated_scanned_folder_count: number | null;
  };

  return {
    outdatedScannedFolderCount: Number(row?.outdated_scanned_folder_count ?? 0),
    scannedFolderCount: Number(row?.scanned_folder_count ?? 0),
  };
}

export function getFolderMetadataScanCompletedAtByPath(
  folderPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, string | null> {
  const originals = folderPaths.filter((p) => p?.trim());
  if (originals.length === 0) return {};

  const normalizedSet = Array.from(
    new Set(originals.map((folderPath) => normalizeFolderLookupKey(folderPath)).filter(Boolean)),
  );
  if (normalizedSet.length === 0) return {};

  const db = getDesktopDatabase();
  const rows =
    process.platform === "win32"
      ? (db
          .prepare(
            `SELECT folder_path, metadata_scanned_at
             FROM folder_analysis_status
             WHERE library_id = ?
               AND folder_path COLLATE NOCASE IN (${normalizedSet.map(() => "?").join(", ")})`,
          )
          .all(libraryId, ...normalizedSet) as Array<{
          folder_path: string;
          metadata_scanned_at: string | null;
        }>)
      : (db
          .prepare(
            `SELECT folder_path, metadata_scanned_at
             FROM folder_analysis_status
             WHERE library_id = ?
               AND folder_path IN (${normalizedSet.map(() => "?").join(", ")})`,
          )
          .all(libraryId, ...normalizedSet) as Array<{
          folder_path: string;
          metadata_scanned_at: string | null;
        }>);

  const result: Record<string, string | null> = {};
  for (const original of originals) {
    const hit = rows.find((row) => folderPathMatchesStored(row.folder_path, original));
    result[original] = hit?.metadata_scanned_at ?? null;
  }
  return result;
}
