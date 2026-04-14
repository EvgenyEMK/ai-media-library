import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { extractDateFromPath } from "../path-extraction/date-extractor";
import { extractDisplayTitle } from "../path-extraction/title-extractor";
import { resolveEventDate } from "../path-extraction/event-date-resolver";
import { mergeMetadataV2 } from "@emk/media-metadata-core";
import type { PathExtractionMetadata } from "../path-extraction/types";

interface PathExtractionInput {
  filePath: string;
  mediaItemId: string;
  /** EXIF-derived photo_taken_at from the catalog row (may be null). */
  photoTakenAt: string | null;
  photoTakenPrecision: "year" | "month" | "day" | "instant" | null;
  fileCreatedAt: string | null;
  libraryId?: string;
}

/**
 * Run fast script-based extraction (date, title) from file path and
 * persist results to the media_items row.
 *
 * Updates: event_date_*, display_title, path_extraction_at, ai_metadata.path_extraction.
 * Does NOT trigger AI invalidation.
 */
export function runPathExtractionForMediaItem(input: PathExtractionInput): void {
  const {
    filePath,
    mediaItemId,
    photoTakenAt,
    photoTakenPrecision,
    fileCreatedAt,
  } = input;
  const libraryId = input.libraryId ?? DEFAULT_LIBRARY_ID;
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  const pathDate = extractDateFromPath(filePath);
  const displayTitle = extractDisplayTitle(filePath);

  const resolved = resolveEventDate(
    { photoTakenAt, photoTakenPrecision },
    pathDate,
    { fileCreatedAt },
  );

  const pathExtraction: PathExtractionMetadata = {
    extracted_at: now,
  };
  if (pathDate) {
    pathExtraction.date = pathDate;
  }
  if (displayTitle) {
    pathExtraction.display_title = displayTitle;
  }

  const existingRow = db
    .prepare(
      `SELECT ai_metadata FROM media_items
       WHERE id = ? AND library_id = ? LIMIT 1`,
    )
    .get(mediaItemId, libraryId) as { ai_metadata: string | null } | undefined;

  let nextAiMetadata: string | null = null;
  if (existingRow) {
    let current: unknown = null;
    if (existingRow.ai_metadata) {
      try {
        current = JSON.parse(existingRow.ai_metadata);
      } catch {
        current = null;
      }
    }
    const merged = mergeMetadataV2(current, {
      schema_version: "2.0",
      path_extraction: pathExtraction,
    });
    nextAiMetadata = JSON.stringify(merged);
  }

  db.prepare(
    `UPDATE media_items SET
       event_date_start = ?,
       event_date_end = ?,
       event_date_precision = ?,
       event_date_source = ?,
       display_title = ?,
       path_extraction_at = ?,
       ai_metadata = COALESCE(?, ai_metadata),
       updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(
    resolved?.start ?? null,
    resolved?.end ?? null,
    resolved?.precision ?? null,
    resolved?.source ?? null,
    displayTitle,
    now,
    nextAiMetadata,
    now,
    mediaItemId,
    libraryId,
  );
}
