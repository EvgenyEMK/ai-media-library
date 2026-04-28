import path from "node:path";
import type {
  FolderAiPipelineLabel,
  FolderGeoCoverageReport,
  FolderGeoLocationDetailsCoverage,
  FolderGeoMediaCoverage,
} from "../../src/shared/ipc";
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

function separatorForFolderPath(folderPath: string): string {
  if (folderPath.includes("\\")) return "\\";
  if (folderPath.includes("/")) return "/";
  return path.sep;
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

function statusLabel(done: number, total: number): FolderAiPipelineLabel {
  if (total === 0) return "empty";
  if (done === 0) return "not_done";
  if (done === total) return "done";
  return "partial";
}

function toMediaCoverage(
  total: number,
  withGpsCount: number,
  locationDetailsDoneCount: number,
): FolderGeoMediaCoverage {
  return {
    total,
    withGpsCount,
    withoutGpsCount: Math.max(0, total - withGpsCount),
    locationDetailsDoneCount,
  };
}

export function toLocationDetailsCoverage(
  doneCount: number,
  totalWithGps: number,
): FolderGeoLocationDetailsCoverage {
  return {
    doneCount,
    totalWithGps,
    label: statusLabel(doneCount, totalWithGps),
  };
}

function emptyGeoCoverage(): FolderGeoCoverageReport {
  return {
    images: toMediaCoverage(0, 0, 0),
    videos: toMediaCoverage(0, 0, 0),
    locationDetails: toLocationDetailsCoverage(0, 0),
  };
}

/**
 * Aggregates embedded GPS and reverse-geocoded location details under a folder.
 * Location details are considered complete when GPS coordinates have a GPS-sourced
 * catalog place projection (`location_source = 'gps'`) with at least one place field.
 */
export function getFolderGeoCoverage(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
}): FolderGeoCoverageReport {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const folderPath = params.folderPath?.trim();
  if (!folderPath) return emptyGeoCoverage();

  const sep = separatorForFolderPath(folderPath);
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;
  const likePattern = `${escapeLikePattern(folderPrefix)}%`;
  const depthClause = params.recursive
    ? ""
    : `AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;
  const imagePred = mediaKindPredicate("image");
  const videoPred = mediaKindPredicate("video");
  const hasGps = "mi.latitude IS NOT NULL AND mi.longitude IS NOT NULL";
  const hasGpsLocationDetails =
    "mi.location_source = 'gps' AND (NULLIF(TRIM(COALESCE(mi.country, '')), '') IS NOT NULL OR NULLIF(TRIM(COALESCE(mi.city, '')), '') IS NOT NULL OR NULLIF(TRIM(COALESCE(mi.location_area, '')), '') IS NOT NULL OR NULLIF(TRIM(COALESCE(mi.location_place, '')), '') IS NOT NULL OR NULLIF(TRIM(COALESCE(mi.location_name, '')), '') IS NOT NULL)";

  const sql = `
    SELECT
      SUM(CASE WHEN ${imagePred} THEN 1 ELSE 0 END) AS image_total,
      SUM(CASE WHEN ${imagePred} AND ${hasGps} THEN 1 ELSE 0 END) AS image_with_gps,
      SUM(CASE WHEN ${imagePred} AND ${hasGps} AND ${hasGpsLocationDetails} THEN 1 ELSE 0 END) AS image_location_details_done,
      SUM(CASE WHEN ${videoPred} THEN 1 ELSE 0 END) AS video_total,
      SUM(CASE WHEN ${videoPred} AND ${hasGps} THEN 1 ELSE 0 END) AS video_with_gps,
      SUM(CASE WHEN ${videoPred} AND ${hasGps} AND ${hasGpsLocationDetails} THEN 1 ELSE 0 END) AS video_location_details_done,
      SUM(CASE WHEN (${imagePred} OR ${videoPred}) AND ${hasGps} AND ${hasGpsLocationDetails} THEN 1 ELSE 0 END) AS location_details_done
    FROM media_items mi
    WHERE mi.library_id = ?
      AND mi.deleted_at IS NULL
      AND (${imagePred} OR ${videoPred})
      AND mi.source_path LIKE ? ESCAPE '~'
      ${depthClause}
  `;

  const bindValues: unknown[] = [libraryId, likePattern];
  if (!params.recursive) {
    bindValues.push(folderPrefix, sep);
  }

  const row = getDesktopDatabase().prepare(sql).get(...bindValues) as {
    image_total: number | null;
    image_with_gps: number | null;
    image_location_details_done: number | null;
    video_total: number | null;
    video_with_gps: number | null;
    video_location_details_done: number | null;
    location_details_done: number | null;
  };

  const imageTotal = Number(row?.image_total ?? 0);
  const imageWithGps = Number(row?.image_with_gps ?? 0);
  const imageLocationDetailsDone = Number(row?.image_location_details_done ?? 0);
  const videoTotal = Number(row?.video_total ?? 0);
  const videoWithGps = Number(row?.video_with_gps ?? 0);
  const videoLocationDetailsDone = Number(row?.video_location_details_done ?? 0);
  const totalWithGps = imageWithGps + videoWithGps;
  const locationDetailsDone = Number(row?.location_details_done ?? 0);

  return {
    images: toMediaCoverage(imageTotal, imageWithGps, imageLocationDetailsDone),
    videos: toMediaCoverage(videoTotal, videoWithGps, videoLocationDetailsDone),
    locationDetails: toLocationDetailsCoverage(locationDetailsDone, totalWithGps),
  };
}
