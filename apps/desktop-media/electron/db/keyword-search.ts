/**
 * FTS5-based keyword (BM25) search over AI-generated image descriptions.
 *
 * The `media_items_fts` virtual table is populated during photo analysis
 * and back-filled via migration 013.  It indexes title, description,
 * location and category extracted from `media_items.ai_metadata`.
 */

import path from "node:path";
import { normalizeMetadata } from "@emk/media-metadata-core";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { appendEventAndLocationPredicates } from "./media-item-sql-filters";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Deterministic FTS tokens for `media_items.star_rating` (-1…5) so keyword search can match
 * e.g. `file_rating_5` or `file_rating_rejected` without token collision in prose fields.
 */
export function starRatingToFtsTokens(starRating: number | null | undefined): string {
  if (starRating === null || starRating === undefined || Number.isNaN(starRating)) {
    return "";
  }
  if (!Number.isFinite(starRating)) {
    return "";
  }
  const n = starRating;
  if (n === -1) {
    return "file_rating_rejected";
  }
  if (n === 0) {
    return "file_rating_unrated";
  }
  if (n >= 1 && n <= 5) {
    return `file_rating_${n}`;
  }
  return "";
}

/**
 * Merges embedded XMP/IPTC (`embedded.*`) with AI analysis (`ai.*`) for FTS rows.
 * Embedded title/description/location take precedence over AI when non-empty.
 */
export function getFtsFieldsFromAiMetadata(
  aiMetadataParsed: unknown,
  locationName: string | null | undefined,
): { title: string; description: string; location: string; category: string; ratingTokens: string } {
  const norm = normalizeMetadata(aiMetadataParsed);
  const emb = isRecord(norm.embedded) ? norm.embedded : {};
  const ai = norm.ai ?? {};

  const embTitle = typeof emb.title === "string" ? emb.title.trim() : "";
  const embDesc = typeof emb.description === "string" ? emb.description.trim() : "";
  const embLoc = typeof emb.location_text === "string" ? emb.location_text.trim() : "";
  const aiTitle = typeof ai.title === "string" ? ai.title.trim() : "";
  const aiDesc = typeof ai.description === "string" ? ai.description.trim() : "";

  const title = embTitle || aiTitle;
  const description = embDesc || aiDesc;
  const locationFromName = typeof locationName === "string" ? locationName.trim() : "";
  const location = locationFromName || embLoc || aiLocationToFtsString(ai.location);
  const category = typeof ai.image_category === "string" ? ai.image_category : "";

  const embStar = emb.star_rating;
  const ratingTokens =
    typeof embStar === "number" && Number.isFinite(embStar) ? starRatingToFtsTokens(embStar) : "";

  return { title, description, location, category, ratingTokens };
}

function aiLocationToFtsString(loc: unknown): string {
  if (!isRecord(loc)) {
    return "";
  }
  const place = typeof loc.place_name === "string" ? loc.place_name.trim() : "";
  const city = typeof loc.city === "string" ? loc.city.trim() : "";
  const country = typeof loc.country === "string" ? loc.country.trim() : "";
  return [place, city, country].filter((s) => s.length > 0).join(", ");
}

/** Rebuild FTS row from current `ai_metadata` + `location_name` (e.g. after file metadata scan). */
export function syncFtsForMediaItem(mediaItemId: string, libraryId = DEFAULT_LIBRARY_ID): void {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT ai_metadata, location_name, star_rating, display_title, location_area, location_place
       FROM media_items WHERE id = ? AND library_id = ? LIMIT 1`,
    )
    .get(mediaItemId, libraryId) as
    | {
        ai_metadata: string | null;
        location_name: string | null;
        star_rating: number | null;
        display_title: string | null;
        location_area: string | null;
        location_place: string | null;
      }
    | undefined;
  if (!row?.ai_metadata) {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.ai_metadata);
  } catch {
    return;
  }
  const fields = getFtsFieldsFromAiMetadata(parsed, row.location_name);

  const titleParts = [fields.title];
  if (row.display_title?.trim()) titleParts.push(row.display_title.trim());
  const mergedTitle = [...new Set(titleParts.filter(Boolean))].join(" | ");

  const locationParts = [fields.location];
  if (row.location_area?.trim()) locationParts.push(row.location_area.trim());
  if (row.location_place?.trim()) locationParts.push(row.location_place.trim());
  const mergedLocation = [...new Set(locationParts.filter(Boolean))].join(", ");

  const ratingTokens =
    typeof row.star_rating === "number" && Number.isFinite(row.star_rating)
      ? starRatingToFtsTokens(row.star_rating)
      : fields.ratingTokens;
  upsertFtsEntry(
    mediaItemId,
    mergedTitle,
    fields.description,
    mergedLocation,
    fields.category,
    ratingTokens,
    libraryId,
  );
}

export interface KeywordSearchRow {
  mediaItemId: string;
  path: string;
  name: string;
  bm25Score: number;
  city: string | null;
  country: string | null;
  peopleDetected: number | null;
  ageMin: number | null;
  ageMax: number | null;
}

export interface KeywordSearchFilters {
  folderPath?: string;
  recursive?: boolean;
  personTagIds?: string[];
  includeUnconfirmedFaces?: boolean;
  eventDateStart?: string;
  eventDateEnd?: string;
  locationQuery?: string;
}

/**
 * Runs a BM25 keyword search against the FTS5 index and returns results
 * sorted by relevance.  The FTS5 `rank` column is the negative BM25 score
 * (lower = more relevant), so we negate it to get a positive relevance value.
 */
export function searchByKeyword(
  query: string,
  filters: KeywordSearchFilters,
  limit = 100,
  libraryId = DEFAULT_LIBRARY_ID,
): KeywordSearchRow[] {
  const db = getDesktopDatabase();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ftsQuery = buildFtsQuery(trimmed);
  if (!ftsQuery) return [];

  const where: string[] = [
    "fts.library_id = ?",
    "mi.deleted_at IS NULL",
    "fts.media_items_fts MATCH ?",
  ];
  const args: unknown[] = [libraryId, ftsQuery];

  if (filters.folderPath) {
    const sep = path.sep;
    const folderPrefix = filters.folderPath.endsWith(sep)
      ? filters.folderPath
      : filters.folderPath + sep;
    where.push("mi.source_path LIKE ? ESCAPE '~'");
    args.push(folderPrefix.replace(/[%_~]/g, "~$&") + "%");
  }

  if (filters.personTagIds && filters.personTagIds.length > 0) {
    const allowUnconfirmed = filters.includeUnconfirmedFaces === true;
    for (const tagId of filters.personTagIds) {
      if (allowUnconfirmed) {
        where.push(
          `(
            EXISTS (
              SELECT 1 FROM media_face_instances fi
              WHERE fi.media_item_id = mi.id AND fi.library_id = ? AND fi.tag_id = ?
            )
            OR EXISTS (
              SELECT 1 FROM media_item_person_suggestions ps
              WHERE ps.media_item_id = mi.id AND ps.library_id = ? AND ps.tag_id = ?
            )
          )`,
        );
        args.push(libraryId, tagId, libraryId, tagId);
      } else {
        where.push(
          `EXISTS (
            SELECT 1 FROM media_face_instances fi
            WHERE fi.media_item_id = mi.id AND fi.library_id = ? AND fi.tag_id = ?
          )`,
        );
        args.push(libraryId, tagId);
      }
    }
  }

  appendEventAndLocationPredicates(where, args, "mi", filters);

  const sql = `
    SELECT
      fts.media_item_id,
      mi.source_path,
      mi.filename,
      mi.city,
      mi.country,
      mi.people_detected,
      mi.age_min,
      mi.age_max,
      fts.rank AS fts_rank
    FROM media_items_fts fts
    INNER JOIN media_items mi ON mi.id = fts.media_item_id
    WHERE ${where.join(" AND ")}
    ORDER BY fts.rank
    LIMIT ?
  `;
  args.push(limit);

  let rows: Array<{
    media_item_id: string;
    source_path: string;
    filename: string;
    city: string | null;
    country: string | null;
    people_detected: number | null;
    age_min: number | null;
    age_max: number | null;
    fts_rank: number;
  }>;

  try {
    rows = db.prepare(sql).all(...args) as typeof rows;
  } catch {
    return [];
  }

  let result = rows.map((row) => ({
    mediaItemId: row.media_item_id,
    path: row.source_path,
    name: row.filename,
    bm25Score: -row.fts_rank,
    city: row.city,
    country: row.country,
    peopleDetected: row.people_detected,
    ageMin: row.age_min,
    ageMax: row.age_max,
  }));

  if (filters.folderPath && !filters.recursive) {
    result = result.filter(
      (row) => path.dirname(row.path) === filters.folderPath,
    );
  }

  return result;
}

/**
 * Converts a user query into an FTS5 query string.
 * Each word is treated as an implicit OR (FTS5 default) so partial matches
 * appear in the results, but items matching more terms rank higher via BM25.
 *
 * Special FTS5 characters are stripped to prevent syntax errors.
 */
export function buildFtsQuery(raw: string): string | null {
  const cleaned = raw
    .replace(/[":*^(){}[\]\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned;
}

/**
 * Inserts or replaces a row in the FTS5 index for a given media item.
 * Called from `upsertPhotoAnalysisResult` after analysis completes.
 */
export function upsertFtsEntry(
  mediaItemId: string,
  title: string | null,
  description: string | null,
  location: string | null,
  category: string | null,
  ratingTokens: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  db.prepare(
    `DELETE FROM media_items_fts WHERE media_item_id = ? AND library_id = ?`,
  ).run(mediaItemId, libraryId);
  db.prepare(
    `INSERT INTO media_items_fts (media_item_id, library_id, title, description, location, category, rating_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    mediaItemId,
    libraryId,
    title ?? "",
    description ?? "",
    location ?? "",
    category ?? "",
    ratingTokens ?? "",
  );
}

/**
 * Removes an FTS5 entry for a media item (e.g. on deletion).
 */
export function deleteFtsEntry(
  mediaItemId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  db.prepare(
    `DELETE FROM media_items_fts WHERE media_item_id = ? AND library_id = ?`,
  ).run(mediaItemId, libraryId);
}
