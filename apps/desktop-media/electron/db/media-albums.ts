import { randomUUID } from "node:crypto";
import type {
  AlbumItemsRequest,
  AlbumItemsResult,
  AlbumListRequest,
  AlbumListResult,
  AlbumMembership,
  AlbumPersonTagSummary,
  MediaAlbumSummary,
  SmartAlbumFilters,
  SmartAlbumItemsRequest,
  SmartAlbumPlacesRequest,
  SmartAlbumPlacesResult,
  SmartAlbumYearsRequest,
  SmartAlbumYearsResult,
} from "@emk/shared-contracts";
import { normalizeAlbumDateBounds } from "@emk/shared-contracts";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { getDesktopDatabase } from "./client";

const DEFAULT_PAGE_SIZE = 48;
const MAX_PAGE_SIZE = 200;
const SMART_ALBUM_MONTH_AREA_CONSOLIDATE_THRESHOLD = 9;
const BEST_OF_YEAR_RANDOM_CANDIDATE_LIMIT = 1000;

interface AlbumRow {
  id: string;
  name: string;
  description: string | null;
  cover_media_item_id: string | null;
  created_at: string;
  updated_at: string;
  media_count: number;
  cover_item_id: string | null;
  cover_source_path: string | null;
  cover_media_kind: "image" | "video" | null;
  location_summary: string | null;
}

interface PersonTagRow {
  album_id: string;
  tag_id: string;
  label: string;
  source: "direct" | "computed";
}

interface AlbumItemRow {
  id: string;
  source_path: string;
  filename: string;
  display_title: string | null;
  media_kind: "image" | "video" | null;
  star_rating: number | null;
  width: number | null;
  height: number | null;
}

interface SmartAlbumPlaceRow {
  country: string;
  place_label: string;
  group_label: string;
  media_count: number;
}

interface SmartAlbumYearRow {
  year: string;
  media_count: number;
  manual_rated_count: number;
  ai_rated_count: number;
  cover_source_path: string | null;
  cover_media_kind: "image" | "video" | null;
}

const AI_AESTHETIC_SCORE_SQL = `COALESCE(
  CAST(json_extract(ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
  CAST(json_extract(ai_metadata, '$.photo_estetic_quality') AS REAL)
)`;
const AI_IMAGE_CATEGORY_SQL = `LOWER(COALESCE(
  CAST(json_extract(ai_metadata, '$.image_analysis.image_category') AS TEXT),
  CAST(json_extract(ai_metadata, '$.image_category') AS TEXT),
  ''
))`;
const SMART_ALBUM_EXCLUDED_CATEGORY_SQL = `(
  ${AI_IMAGE_CATEGORY_SQL} LIKE 'document%'
  OR ${AI_IMAGE_CATEGORY_SQL} = 'invoice_or_receipt'
  OR ${AI_IMAGE_CATEGORY_SQL} = 'presentation_slide'
  OR ${AI_IMAGE_CATEGORY_SQL} = 'diagram'
  OR ${AI_IMAGE_CATEGORY_SQL} LIKE '%screenshot%'
)`;

function resolveMediaItemId(mediaItemIdOrPath: string, libraryId: string): string | null {
  const id = mediaItemIdOrPath.trim();
  if (!id) {
    return null;
  }
  const row = getDesktopDatabase()
    .prepare(
      `SELECT id
       FROM media_items
       WHERE library_id = ? AND deleted_at IS NULL AND (id = ? OR source_path = ?)
       LIMIT 1`,
    )
    .get(libraryId, id, id) as { id: string } | undefined;
  return row?.id ?? null;
}

function clampPage(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(0, Math.trunc(value ?? fallback)), max);
}

function buildAlbumWhere(request: AlbumListRequest, libraryId: string): {
  where: string[];
  args: unknown[];
} {
  const where = ["a.library_id = ?"];
  const args: unknown[] = [libraryId];
  const title = request.titleQuery?.trim();
  if (title) {
    where.push("a.name LIKE ?");
    args.push(`%${title}%`);
  }
  const location = request.locationQuery?.trim();
  if (location) {
    where.push(`EXISTS (
      SELECT 1
      FROM media_album_items mai_loc
      JOIN media_items mi_loc
        ON mi_loc.id = mai_loc.media_item_id
       AND mi_loc.library_id = mai_loc.library_id
      WHERE mai_loc.media_album_id = a.id
        AND mai_loc.library_id = a.library_id
        AND mi_loc.deleted_at IS NULL
        AND (
          mi_loc.country LIKE ?
          OR mi_loc.city LIKE ?
          OR mi_loc.location_area LIKE ?
          OR mi_loc.location_place LIKE ?
          OR mi_loc.location_name LIKE ?
        )
    )`);
    const q = `%${location}%`;
    args.push(q, q, q, q, q);
  }
  const bounds = normalizeAlbumDateBounds(request);
  if (bounds.start) {
    where.push(`EXISTS (
      SELECT 1
      FROM media_album_items mai_date
      JOIN media_items mi_date
        ON mi_date.id = mai_date.media_item_id
       AND mi_date.library_id = mai_date.library_id
      WHERE mai_date.media_album_id = a.id
        AND mai_date.library_id = a.library_id
        AND mi_date.deleted_at IS NULL
        AND COALESCE(mi_date.photo_taken_at, mi_date.file_created_at) >= ?
    )`);
    args.push(bounds.start);
  }
  if (bounds.end) {
    where.push(`EXISTS (
      SELECT 1
      FROM media_album_items mai_date
      JOIN media_items mi_date
        ON mi_date.id = mai_date.media_item_id
       AND mi_date.library_id = mai_date.library_id
      WHERE mai_date.media_album_id = a.id
        AND mai_date.library_id = a.library_id
        AND mi_date.deleted_at IS NULL
        AND COALESCE(mi_date.photo_taken_at, mi_date.file_created_at) <= ?
    )`);
    args.push(bounds.end);
  }
  const personTagIds = (request.personTagIds ?? []).map((id) => id.trim()).filter(Boolean);
  for (const tagId of personTagIds) {
    where.push(`(
      EXISTS (
        SELECT 1
        FROM media_album_person_tags mapt
        WHERE mapt.album_id = a.id
          AND mapt.library_id = a.library_id
          AND mapt.tag_id = ?
      )
      OR EXISTS (
        SELECT 1
        FROM media_album_items mai_person
        JOIN media_face_instances fi
          ON fi.media_item_id = mai_person.media_item_id
         AND fi.library_id = mai_person.library_id
        WHERE mai_person.media_album_id = a.id
          AND mai_person.library_id = a.library_id
          AND fi.tag_id = ?
      )
    )`);
    args.push(tagId, tagId);
  }
  return { where, args };
}

function mapPersonTags(rows: PersonTagRow[]): Record<string, AlbumPersonTagSummary[]> {
  const byAlbum: Record<string, Map<string, AlbumPersonTagSummary>> = {};
  for (const row of rows) {
    const map = byAlbum[row.album_id] ?? new Map<string, AlbumPersonTagSummary>();
    const existing = map.get(row.tag_id);
    if (existing) {
      existing.source = "both";
    } else {
      map.set(row.tag_id, { id: row.tag_id, label: row.label, source: row.source });
    }
    byAlbum[row.album_id] = map;
  }
  const result: Record<string, AlbumPersonTagSummary[]> = {};
  for (const [albumId, map] of Object.entries(byAlbum)) {
    result[albumId] = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }
  return result;
}

function mapAlbumItemRows(rows: AlbumItemRow[]): AlbumItemsResult["rows"] {
  return rows.map((row) => ({
    id: row.id,
    sourcePath: row.source_path,
    title: row.display_title ?? row.filename,
    imageUrl: row.source_path,
    mediaKind: row.media_kind ?? "image",
    starRating: row.star_rating,
    width: row.width,
    height: row.height,
  }));
}

function appendSmartAlbumCommonFilters(
  where: string[],
  args: unknown[],
  alias: string,
  libraryId: string,
  filters?: SmartAlbumFilters,
): void {
  const query = filters?.query?.trim();
  if (query) {
    const like = `%${query}%`;
    where.push(`(
      COALESCE(${alias}.display_title, '') LIKE ?
      OR COALESCE(${alias}.filename, '') LIKE ?
      OR COALESCE(CAST(json_extract(${alias}.ai_metadata, '$.image_analysis.title') AS TEXT), '') LIKE ?
      OR COALESCE(CAST(json_extract(${alias}.ai_metadata, '$.image_analysis.description') AS TEXT), '') LIKE ?
      OR COALESCE(CAST(json_extract(${alias}.ai_metadata, '$.title') AS TEXT), '') LIKE ?
      OR COALESCE(CAST(json_extract(${alias}.ai_metadata, '$.description') AS TEXT), '') LIKE ?
    )`);
    args.push(like, like, like, like, like, like);
  }
  const normalizedPersonTagIds = (filters?.personTagIds ?? []).map((id) => id.trim()).filter(Boolean);
  const allowUnconfirmed = filters?.includeUnconfirmedFaces === true;
  for (const personTagId of normalizedPersonTagIds) {
    if (allowUnconfirmed) {
      where.push(`(
        EXISTS (
          SELECT 1
          FROM media_face_instances fi
          WHERE fi.library_id = ?
            AND fi.media_item_id = ${alias}.id
            AND fi.tag_id = ?
        )
        OR EXISTS (
          SELECT 1
          FROM media_item_person_suggestions ps
          WHERE ps.library_id = ?
            AND ps.media_item_id = ${alias}.id
            AND ps.tag_id = ?
        )
      )`);
      args.push(libraryId, personTagId, libraryId, personTagId);
    } else {
      where.push(`EXISTS (
        SELECT 1
        FROM media_face_instances fi
        WHERE fi.library_id = ?
          AND fi.media_item_id = ${alias}.id
          AND fi.tag_id = ?
      )`);
      args.push(libraryId, personTagId);
    }
  }
  appendSmartAlbumRatingFilters(where, args, alias, filters);
  const from = filters?.dateFrom?.trim();
  if (from) {
    where.push(`COALESCE(${alias}.photo_taken_at, ${alias}.file_created_at) >= ?`);
    args.push(from);
  }
  const to = filters?.dateTo?.trim();
  if (to) {
    where.push(`COALESCE(${alias}.photo_taken_at, ${alias}.file_created_at) <= ?`);
    args.push(to);
  }
}

function appendSmartAlbumRatingFilters(
  where: string[],
  args: unknown[],
  alias: string,
  filters?: SmartAlbumFilters,
): void {
  const ratingPredicates: string[] = [];
  const starRatingMin = filters?.starRatingMin;
  if (Number.isFinite(starRatingMin)) {
    const op = filters?.starRatingOperator === "eq" ? "=" : ">=";
    ratingPredicates.push(`COALESCE(${alias}.star_rating, 0) ${op} ?`);
    args.push(Math.max(0, Math.trunc(starRatingMin ?? 0)));
  }
  const aiAestheticMin = filters?.aiAestheticMin;
  if (Number.isFinite(aiAestheticMin)) {
    const aiAestheticSql = `COALESCE(
      CAST(json_extract(${alias}.ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
      CAST(json_extract(${alias}.ai_metadata, '$.photo_estetic_quality') AS REAL),
      0
    )`;
    const min = Math.max(0, Number(aiAestheticMin ?? 0));
    if (filters?.aiAestheticOperator === "eq") {
      ratingPredicates.push(`(${aiAestheticSql} >= ? AND ${aiAestheticSql} <= ?)`);
      args.push(min, Math.min(10, min + 1));
    } else {
      ratingPredicates.push(`${aiAestheticSql} >= ?`);
      args.push(min);
    }
  }
  if (ratingPredicates.length === 0) {
    return;
  }
  const joiner = filters?.ratingLogic === "and" ? " AND " : " OR ";
  where.push(`(${ratingPredicates.join(joiner)})`);
}

function listPersonTagsForAlbums(albumIds: string[], libraryId: string): Record<string, AlbumPersonTagSummary[]> {
  if (albumIds.length === 0) {
    return {};
  }
  const placeholders = albumIds.map(() => "?").join(", ");
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT mapt.album_id, t.id AS tag_id, t.name AS label, 'direct' AS source
       FROM media_album_person_tags mapt
       JOIN media_tags t ON t.id = mapt.tag_id AND t.library_id = mapt.library_id
       WHERE mapt.library_id = ? AND mapt.album_id IN (${placeholders})
       UNION ALL
       SELECT DISTINCT mai.media_album_id AS album_id, t.id AS tag_id, t.name AS label, 'computed' AS source
       FROM media_album_items mai
       JOIN media_face_instances fi
         ON fi.media_item_id = mai.media_item_id
        AND fi.library_id = mai.library_id
       JOIN media_tags t ON t.id = fi.tag_id AND t.library_id = fi.library_id
       WHERE mai.library_id = ? AND mai.media_album_id IN (${placeholders}) AND fi.tag_id IS NOT NULL`,
    )
    .all(libraryId, ...albumIds, libraryId, ...albumIds) as PersonTagRow[];
  return mapPersonTags(rows);
}

export function listAlbums(
  request: AlbumListRequest = {},
  libraryId = DEFAULT_LIBRARY_ID,
): AlbumListResult {
  const db = getDesktopDatabase();
  const limit = clampPage(request.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = clampPage(request.offset, 0, Number.MAX_SAFE_INTEGER);
  const { where, args } = buildAlbumWhere(request, libraryId);
  const whereSql = where.join(" AND ");
  const total = db
    .prepare(`SELECT COUNT(*) AS cnt FROM media_albums a WHERE ${whereSql}`)
    .get(...args) as { cnt: number } | undefined;
  const rows = db
    .prepare(
      `SELECT
         a.id,
         a.name,
         a.description,
         a.cover_media_item_id,
         a.created_at,
         a.updated_at,
         COUNT(DISTINCT mai.media_item_id) AS media_count,
         COALESCE(manual_cover.id, fallback_cover.id) AS cover_item_id,
         COALESCE(manual_cover.source_path, fallback_cover.source_path) AS cover_source_path,
         COALESCE(manual_cover.media_kind, fallback_cover.media_kind) AS cover_media_kind,
         COALESCE(
           NULLIF(TRIM(MAX(mi.country || CASE WHEN mi.city IS NOT NULL AND mi.city <> '' THEN ', ' || mi.city ELSE '' END)), ''),
           NULLIF(TRIM(MAX(mi.city)), ''),
           NULLIF(TRIM(MAX(mi.location_name)), '')
         ) AS location_summary
       FROM media_albums a
       LEFT JOIN media_album_items mai ON mai.media_album_id = a.id AND mai.library_id = a.library_id
       LEFT JOIN media_items mi ON mi.id = mai.media_item_id AND mi.library_id = mai.library_id AND mi.deleted_at IS NULL
       LEFT JOIN media_items manual_cover
         ON manual_cover.id = a.cover_media_item_id
        AND manual_cover.library_id = a.library_id
        AND manual_cover.deleted_at IS NULL
       LEFT JOIN media_items fallback_cover
         ON fallback_cover.id = (
           SELECT mi_cover.id
           FROM media_album_items mai_cover
           JOIN media_items mi_cover
             ON mi_cover.id = mai_cover.media_item_id
            AND mi_cover.library_id = mai_cover.library_id
           WHERE mai_cover.media_album_id = a.id
             AND mai_cover.library_id = a.library_id
             AND mi_cover.deleted_at IS NULL
           ORDER BY
             COALESCE(mi_cover.star_rating, -1) DESC,
             COALESCE(CAST(json_extract(mi_cover.ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL), -1) DESC,
             COALESCE(mai_cover.position, 2147483647) ASC,
             mai_cover.created_at ASC
           LIMIT 1
         )
        AND fallback_cover.library_id = a.library_id
       WHERE ${whereSql}
       GROUP BY a.id
       ORDER BY a.updated_at DESC, a.name COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...args, limit, offset) as AlbumRow[];
  const personTagsByAlbum = listPersonTagsForAlbums(
    rows.map((row) => row.id),
    libraryId,
  );
  return {
    rows: rows.map(
      (row): MediaAlbumSummary => ({
        id: row.id,
        title: row.name,
        description: row.description,
        coverMediaItemId: row.cover_media_item_id ?? row.cover_item_id,
        coverSourcePath: row.cover_source_path,
        coverImageUrl: null,
        coverMediaKind: row.cover_media_kind ?? "image",
        mediaCount: row.media_count,
        locationSummary: row.location_summary,
        personTags: personTagsByAlbum[row.id] ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    ),
    totalCount: total?.cnt ?? 0,
  };
}

export function createAlbum(title: string, libraryId = DEFAULT_LIBRARY_ID): MediaAlbumSummary {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Album title is required.");
  }
  const now = new Date().toISOString();
  const id = randomUUID();
  getDesktopDatabase()
    .prepare(
      `INSERT INTO media_albums (id, library_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
    )
    .run(id, libraryId, trimmed, now, now);
  const album = listAlbums({ titleQuery: trimmed, limit: 1 }, libraryId).rows.find((row) => row.id === id);
  if (!album) {
    throw new Error("Failed to create album.");
  }
  return album;
}

export function updateAlbumTitle(
  albumId: string,
  title: string,
  libraryId = DEFAULT_LIBRARY_ID,
): MediaAlbumSummary {
  const trimmed = title.trim();
  if (!albumId.trim() || !trimmed) {
    throw new Error("Album id and title are required.");
  }
  getDesktopDatabase()
    .prepare(`UPDATE media_albums SET name = ?, updated_at = ? WHERE id = ? AND library_id = ?`)
    .run(trimmed, new Date().toISOString(), albumId, libraryId);
  const album = listAlbums({ limit: MAX_PAGE_SIZE }, libraryId).rows.find((row) => row.id === albumId);
  if (!album) {
    throw new Error("Album not found.");
  }
  return album;
}

export function deleteAlbum(albumId: string, libraryId = DEFAULT_LIBRARY_ID): void {
  const db = getDesktopDatabase();
  db.transaction(() => {
    db.prepare(`DELETE FROM media_album_items WHERE media_album_id = ? AND library_id = ?`).run(
      albumId,
      libraryId,
    );
    db.prepare(`DELETE FROM media_album_person_tags WHERE album_id = ? AND library_id = ?`).run(
      albumId,
      libraryId,
    );
    db.prepare(`DELETE FROM media_album_categories WHERE album_id = ? AND library_id = ?`).run(
      albumId,
      libraryId,
    );
    db.prepare(`DELETE FROM media_albums WHERE id = ? AND library_id = ?`).run(albumId, libraryId);
  })();
}

export function addMediaItemsToAlbum(
  albumId: string,
  mediaItemIds: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const ids = Array.from(new Set(mediaItemIds.map((id) => id.trim()).filter(Boolean)));
  if (!albumId.trim() || ids.length === 0) {
    return;
  }
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const resolvedMediaItemIds = ids
    .map((id) => resolveMediaItemId(id, libraryId))
    .filter((id): id is string => Boolean(id));
  if (resolvedMediaItemIds.length === 0) {
    return;
  }
  const currentMax = db
    .prepare(
      `SELECT COALESCE(MAX(position), -1) AS max_position
       FROM media_album_items
       WHERE media_album_id = ? AND library_id = ?`,
    )
    .get(albumId, libraryId) as { max_position: number } | undefined;
  let position = (currentMax?.max_position ?? -1) + 1;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO media_album_items
       (id, library_id, media_album_id, media_item_id, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  db.transaction(() => {
    for (const mediaItemId of resolvedMediaItemIds) {
      insert.run(randomUUID(), libraryId, albumId, mediaItemId, position, now);
      position += 1;
    }
    db.prepare(`UPDATE media_albums SET updated_at = ? WHERE id = ? AND library_id = ?`).run(
      now,
      albumId,
      libraryId,
    );
  })();
}

export function removeMediaItemFromAlbum(
  albumId: string,
  mediaItemIdOrPath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const mediaItemId = resolveMediaItemId(mediaItemIdOrPath, libraryId);
  if (!mediaItemId) {
    return;
  }
  getDesktopDatabase()
    .prepare(
      `DELETE FROM media_album_items
       WHERE media_album_id = ? AND media_item_id = ? AND library_id = ?`,
    )
    .run(albumId, mediaItemId, libraryId);
}

export function setAlbumCover(
  albumId: string,
  mediaItemIdOrPath: string | null,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const mediaItemId = mediaItemIdOrPath ? resolveMediaItemId(mediaItemIdOrPath, libraryId) : null;
  getDesktopDatabase()
    .prepare(`UPDATE media_albums SET cover_media_item_id = ?, updated_at = ? WHERE id = ? AND library_id = ?`)
    .run(mediaItemId, new Date().toISOString(), albumId, libraryId);
}

export function listAlbumItems(
  request: AlbumItemsRequest,
  libraryId = DEFAULT_LIBRARY_ID,
): AlbumItemsResult {
  const limit = clampPage(request.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = clampPage(request.offset, 0, Number.MAX_SAFE_INTEGER);
  const db = getDesktopDatabase();
  const total = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM media_album_items mai
       JOIN media_items mi ON mi.id = mai.media_item_id AND mi.library_id = mai.library_id
       WHERE mai.media_album_id = ? AND mai.library_id = ? AND mi.deleted_at IS NULL`,
    )
    .get(request.albumId, libraryId) as { cnt: number } | undefined;
  const rows = db
    .prepare(
      `SELECT mi.id, mi.source_path, mi.filename, mi.display_title, mi.media_kind, mi.star_rating, mi.width, mi.height
       FROM media_album_items mai
       JOIN media_items mi ON mi.id = mai.media_item_id AND mi.library_id = mai.library_id
       WHERE mai.media_album_id = ? AND mai.library_id = ? AND mi.deleted_at IS NULL
       ORDER BY COALESCE(mai.position, 2147483647) ASC, mai.created_at ASC
       LIMIT ? OFFSET ?`,
    )
    .all(request.albumId, libraryId, limit, offset) as AlbumItemRow[];
  return {
    rows: mapAlbumItemRows(rows),
    totalCount: total?.cnt ?? 0,
  };
}

function normalizeSmartAlbumPlacesRequest(request?: SmartAlbumPlacesRequest): SmartAlbumPlacesRequest {
  const threshold = Number.isFinite(request?.consolidateMonthAreaThreshold)
    ? Math.max(0, Math.trunc(request?.consolidateMonthAreaThreshold ?? SMART_ALBUM_MONTH_AREA_CONSOLIDATE_THRESHOLD))
    : SMART_ALBUM_MONTH_AREA_CONSOLIDATE_THRESHOLD;
  return {
    grouping:
      request?.grouping === "area-city" || request?.grouping === "month-area"
        ? request.grouping
        : "year-city",
    source: request?.source === "non-gps" ? "non-gps" : "gps",
    filters: request?.filters,
    consolidateMonthAreaThreshold: threshold,
  };
}

export function listSmartAlbumPlaces(
  request?: SmartAlbumPlacesRequest,
  libraryId = DEFAULT_LIBRARY_ID,
): SmartAlbumPlacesResult {
  const normalizedRequest = normalizeSmartAlbumPlacesRequest(request);
  const placeExpression =
    normalizedRequest.grouping === "area-city"
      ? "TRIM(city)"
      : normalizedRequest.grouping === "month-area"
        ? "COALESCE(NULLIF(TRIM(location_area), ''), 'Unknown area')"
        : "COALESCE(NULLIF(TRIM(location_area), ''), 'Unknown area')";
  const groupExpression =
    normalizedRequest.grouping === "area-city"
      ? "COALESCE(NULLIF(TRIM(location_area), ''), 'Unknown area')"
      : normalizedRequest.grouping === "month-area"
        ? "SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 7)"
        : "SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 4)";
  const groupPredicate =
    normalizedRequest.grouping === "year-city"
      ? "group_label GLOB '[0-9][0-9][0-9][0-9]'"
      : normalizedRequest.grouping === "month-area"
        ? "group_label GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'"
        : "1 = 1";
  const sourcePredicate = normalizedRequest.source === "gps"
    ? "location_source = 'gps'"
    : "(location_source IS NULL OR location_source <> 'gps')";
  const placeWhere = [
    "library_id = ?",
    "deleted_at IS NULL",
    sourcePredicate,
    "NULLIF(TRIM(country), '') IS NOT NULL",
    normalizedRequest.grouping === "area-city"
      ? "NULLIF(TRIM(city), '') IS NOT NULL"
      : normalizedRequest.grouping === "month-area"
        ? "NULLIF(TRIM(location_area), '') IS NOT NULL"
        : "NULLIF(TRIM(location_area), '') IS NOT NULL",
    "(NULLIF(TRIM(city), '') IS NULL OR TRIM(country) <> TRIM(city))",
    `NOT ${SMART_ALBUM_EXCLUDED_CATEGORY_SQL}`,
  ];
  const placeArgs: unknown[] = [libraryId];
  appendSmartAlbumCommonFilters(placeWhere, placeArgs, "media_items", libraryId, normalizedRequest.filters);
  const rows = getDesktopDatabase()
    .prepare(
      `WITH place_items AS (
         SELECT
           TRIM(country) AS country,
           ${placeExpression} AS place_label,
           ${groupExpression} AS group_label
         FROM media_items
         WHERE ${placeWhere.join("\n           AND ")}
       ),
       place_counts AS (
         SELECT country, place_label, group_label, COUNT(*) AS media_count
         FROM place_items
         WHERE ${groupPredicate}
         GROUP BY country, place_label, group_label
       )
       SELECT pc.country, pc.place_label, pc.group_label, pc.media_count
       FROM place_counts pc
       ORDER BY pc.country COLLATE NOCASE ASC, pc.group_label DESC, pc.place_label COLLATE NOCASE ASC`,
    )
    .all(...placeArgs) as SmartAlbumPlaceRow[];

  const countries = new Map<string, SmartAlbumPlacesResult["countries"][number]>();
  for (const row of rows) {
    const existing = countries.get(row.country) ?? {
      country: row.country,
      mediaCount: 0,
      groups: [],
    };
    existing.mediaCount += row.media_count;
    let group = existing.groups.find((item) => item.group === row.group_label);
    if (!group) {
      group = {
        group: row.group_label,
        mediaCount: 0,
        entries: [],
      };
      existing.groups.push(group);
    }
    group.mediaCount += row.media_count;
    group.entries.push({
      id: `place:${normalizedRequest.source}:${normalizedRequest.grouping}:${row.country}:${row.group_label}:${row.place_label}`,
      country: row.country,
      city: row.place_label,
      group: row.group_label,
      label: row.place_label,
      mediaCount: row.media_count,
    });
    countries.set(row.country, existing);
  }
  const resultCountries = Array.from(countries.values());
  if (normalizedRequest.grouping === "month-area") {
    return {
      countries: resultCountries.map((country) =>
        shouldConsolidateMonthAreaCountry(
          country,
          normalizedRequest.consolidateMonthAreaThreshold ?? SMART_ALBUM_MONTH_AREA_CONSOLIDATE_THRESHOLD,
        )
          ? consolidateMonthAreaCountryToYearArea(country, normalizedRequest.source)
          : country,
      ),
    };
  }
  return { countries: resultCountries };
}

function shouldConsolidateMonthAreaCountry(
  country: SmartAlbumPlacesResult["countries"][number],
  threshold: number,
): boolean {
  const leafCount = country.groups.reduce((count, group) => count + group.entries.length, 0);
  return leafCount > threshold;
}

function consolidateMonthAreaCountryToYearArea(
  country: SmartAlbumPlacesResult["countries"][number],
  source: SmartAlbumPlacesRequest["source"],
): SmartAlbumPlacesResult["countries"][number] {
  const byYearArea = new Map<string, SmartAlbumPlaceRow>();
  for (const group of country.groups) {
    const year = group.group.slice(0, 4);
    for (const entry of group.entries) {
      const key = `${year}::${entry.label}`;
      const current = byYearArea.get(key) ?? {
        country: country.country,
        group_label: year,
        place_label: entry.label,
        media_count: 0,
      };
      current.media_count += entry.mediaCount;
      byYearArea.set(key, current);
    }
  }
  const groups = new Map<string, SmartAlbumPlacesResult["countries"][number]["groups"][number]>();
  for (const row of Array.from(byYearArea.values()).sort((a, b) => {
    const yearSort = b.group_label.localeCompare(a.group_label);
    return yearSort !== 0 ? yearSort : a.place_label.localeCompare(b.place_label);
  })) {
    const group = groups.get(row.group_label) ?? {
      group: row.group_label,
      mediaCount: 0,
      entries: [],
    };
    group.mediaCount += row.media_count;
    group.entries.push({
      id: `place:${source}:month-area:${row.country}:${row.group_label}:${row.place_label}`,
      country: row.country,
      city: row.place_label,
      group: row.group_label,
      label: row.place_label,
      mediaCount: row.media_count,
    });
    groups.set(row.group_label, group);
  }
  return {
    country: country.country,
    mediaCount: country.mediaCount,
    groups: Array.from(groups.values()),
  };
}

export function listSmartAlbumYears(
  request?: SmartAlbumYearsRequest,
  libraryId = DEFAULT_LIBRARY_ID,
): SmartAlbumYearsResult {
  const where = [
    "library_id = ?",
    "deleted_at IS NULL",
    "COALESCE(photo_taken_at, file_created_at) IS NOT NULL",
    "SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 4) GLOB '[0-9][0-9][0-9][0-9]'",
    `NOT ${SMART_ALBUM_EXCLUDED_CATEGORY_SQL}`,
  ];
  const args: unknown[] = [libraryId];
  appendSmartAlbumCommonFilters(where, args, "media_items", libraryId, request?.filters);
  const rows = getDesktopDatabase()
    .prepare(
      `WITH valid_items AS (
         SELECT
           star_rating,
           ${AI_AESTHETIC_SCORE_SQL} AS aesthetic_score,
           SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 4) AS year
         FROM media_items
         WHERE ${where.join("\n           AND ")}
       )
       SELECT
         year,
         COUNT(*) AS media_count,
         SUM(CASE WHEN COALESCE(star_rating, 0) > 0 THEN 1 ELSE 0 END) AS manual_rated_count,
         SUM(CASE WHEN COALESCE(aesthetic_score, 0) > 0 THEN 1 ELSE 0 END) AS ai_rated_count,
         NULL AS cover_source_path,
         NULL AS cover_media_kind
       FROM valid_items
       GROUP BY year
       ORDER BY year DESC`,
    )
    .all(...args) as SmartAlbumYearRow[];

  return {
    years: rows.map((row) => ({
      year: row.year,
      mediaCount: row.media_count,
      manualRatedCount: row.manual_rated_count,
      aiRatedCount: row.ai_rated_count,
      coverSourcePath: row.cover_source_path,
      coverMediaKind: row.cover_media_kind ?? "image",
    })),
  };
}

export function listSmartAlbumItems(
  request: SmartAlbumItemsRequest,
  libraryId = DEFAULT_LIBRARY_ID,
): AlbumItemsResult {
  const limit = clampPage(request.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = clampPage(request.offset, 0, Number.MAX_SAFE_INTEGER);
  const db = getDesktopDatabase();

  if (request.kind === "place") {
    const sourcePredicate = request.source === "gps"
      ? "mi.location_source = 'gps'"
      : "(mi.location_source IS NULL OR mi.location_source <> 'gps')";
    const groupPredicate =
      request.grouping === "area-city"
        ? "COALESCE(NULLIF(TRIM(mi.location_area), ''), 'Unknown area') = ?"
        : request.grouping === "month-area"
          ? request.group.length === 4
            ? "SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?"
            : "SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 7) = ?"
        : "SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?";
    const placePredicate =
      request.grouping === "area-city"
        ? "TRIM(mi.city) = ?"
        : request.grouping === "month-area"
          ? "COALESCE(NULLIF(TRIM(mi.location_area), ''), 'Unknown area') = ?"
          : "COALESCE(NULLIF(TRIM(mi.location_area), ''), 'Unknown area') = ?";
    const categoryExclusion = `NOT ${SMART_ALBUM_EXCLUDED_CATEGORY_SQL.replaceAll(
      "ai_metadata",
      "mi.ai_metadata",
    )}`;
    const commonWhere: string[] = [categoryExclusion];
    const commonArgs: unknown[] = [];
    appendSmartAlbumCommonFilters(commonWhere, commonArgs, "mi", libraryId, request.filters);
    const total = db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM media_items mi
         WHERE mi.library_id = ?
           AND mi.deleted_at IS NULL
           AND ${sourcePredicate}
           AND TRIM(mi.country) = ?
           AND ${placePredicate}
           AND ${groupPredicate}
           AND ${commonWhere.join("\n           AND ")}`,
      )
      .get(libraryId, request.country.trim(), request.city.trim(), request.group.trim(), ...commonArgs) as
      | { cnt: number }
      | undefined;
    const rows = db
      .prepare(
        `SELECT mi.id, mi.source_path, mi.filename, mi.display_title, mi.media_kind, mi.star_rating, mi.width, mi.height
         FROM media_items mi
         WHERE mi.library_id = ?
           AND mi.deleted_at IS NULL
           AND ${sourcePredicate}
           AND TRIM(mi.country) = ?
           AND ${placePredicate}
           AND ${groupPredicate}
           AND ${commonWhere.join("\n           AND ")}
         ORDER BY COALESCE(mi.photo_taken_at, mi.file_created_at) DESC, mi.source_path COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(
        libraryId,
        request.country.trim(),
        request.city.trim(),
        request.group.trim(),
        ...commonArgs,
        limit,
        offset,
      ) as AlbumItemRow[];
    return { rows: mapAlbumItemRows(rows), totalCount: total?.cnt ?? 0 };
  }

  const year = request.year.trim();
  const candidateLimit = request.randomize
    ? clampPage(request.randomCandidateLimit, BEST_OF_YEAR_RANDOM_CANDIDATE_LIMIT, 10000)
    : 2147483647;
  const qualityOrderBy = `COALESCE(mi.star_rating, -1) DESC,
    COALESCE(
      CAST(json_extract(mi.ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
      CAST(json_extract(mi.ai_metadata, '$.photo_estetic_quality') AS REAL),
      -1
    ) DESC,
    COALESCE(mi.photo_taken_at, mi.file_created_at) DESC,
    mi.source_path COLLATE NOCASE ASC`;
  const resultOrderBy = request.randomize ? "RANDOM()" : qualityOrderBy.replaceAll("mi.", "");
  const commonWhere: string[] = [
    `NOT ${SMART_ALBUM_EXCLUDED_CATEGORY_SQL.replaceAll("ai_metadata", "mi.ai_metadata")}`,
  ];
  const commonArgs: unknown[] = [];
  appendSmartAlbumCommonFilters(commonWhere, commonArgs, "mi", libraryId, request.filters);
  const total = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM media_items mi
       WHERE mi.library_id = ?
         AND mi.deleted_at IS NULL
         AND SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?
         ${commonWhere.length > 0 ? `AND ${commonWhere.join("\n         AND ")}` : ""}`,
    )
    .get(libraryId, year, ...commonArgs) as { cnt: number } | undefined;
  const rows = db
    .prepare(
      `WITH filtered_items AS (
         SELECT mi.id, mi.source_path, mi.filename, mi.display_title, mi.media_kind, mi.star_rating, mi.width, mi.height,
                mi.photo_taken_at, mi.file_created_at, mi.ai_metadata
         FROM media_items mi
       WHERE mi.library_id = ?
         AND mi.deleted_at IS NULL
         AND SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?
         ${commonWhere.length > 0 ? `AND ${commonWhere.join("\n         AND ")}` : ""}
       ORDER BY ${qualityOrderBy}
       LIMIT ?
       )
       SELECT id, source_path, filename, display_title, media_kind, star_rating, width, height
       FROM filtered_items
       ORDER BY ${resultOrderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(libraryId, year, ...commonArgs, candidateLimit, limit, offset) as AlbumItemRow[];
  return { rows: mapAlbumItemRows(rows), totalCount: total?.cnt ?? 0 };
}

export function listAlbumsForMediaItem(
  mediaItemIdOrPath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): AlbumMembership[] {
  const mediaItemId = resolveMediaItemId(mediaItemIdOrPath, libraryId);
  if (!mediaItemId) {
    return [];
  }
  return getDesktopDatabase()
    .prepare(
      `SELECT a.id AS albumId, a.name AS title
       FROM media_album_items mai
       JOIN media_albums a ON a.id = mai.media_album_id AND a.library_id = mai.library_id
       WHERE mai.library_id = ? AND mai.media_item_id = ?
       ORDER BY a.name COLLATE NOCASE ASC`,
    )
    .all(libraryId, mediaItemId) as AlbumMembership[];
}
