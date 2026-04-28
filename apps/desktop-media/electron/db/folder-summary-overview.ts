import path from "node:path";
import type { FolderAiSummaryOverview } from "../../src/shared/ipc";
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
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
      notFullyScannedDirectSubfolderCount: 0,
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

  const sep = path.sep;
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
      MAX(mi.metadata_extracted_at) AS last_metadata_extracted_at,
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
    last_metadata_extracted_at: string | null;
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
      lastMetadataExtractedAt: row?.last_metadata_extracted_at ?? null,
      scannedCount,
      unscannedCount,
      totalMedia: scannedCount + unscannedCount,
      notFullyScannedDirectSubfolderCount: 0,
    },
  };
}

export function getFolderMetadataScanCompletedAtByPath(
  folderPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, string | null> {
  const normalizedPaths = Array.from(new Set(folderPaths.map((folderPath) => folderPath.trim()).filter(Boolean)));
  if (normalizedPaths.length === 0) return {};

  const placeholders = normalizedPaths.map(() => "?").join(", ");
  const rows = getDesktopDatabase()
    .prepare(
      `SELECT folder_path, metadata_scanned_at
       FROM folder_analysis_status
       WHERE library_id = ?
         AND folder_path IN (${placeholders})`,
    )
    .all(libraryId, ...normalizedPaths) as Array<{
    folder_path: string;
    metadata_scanned_at: string | null;
  }>;

  return rows.reduce<Record<string, string | null>>((acc, row) => {
    acc[row.folder_path] = row.metadata_scanned_at;
    return acc;
  }, {});
}
