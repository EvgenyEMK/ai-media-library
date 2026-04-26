import { randomUUID } from "node:crypto";
import type {
  AlbumItemsRequest,
  AlbumItemsResult,
  AlbumListRequest,
  AlbumListResult,
  AlbumMembership,
  AlbumPersonTagSummary,
  MediaAlbumSummary,
  SmartAlbumItemsRequest,
  SmartAlbumPlacesRequest,
  SmartAlbumPlacesResult,
  SmartAlbumYearsResult,
} from "@emk/shared-contracts";
import { normalizeAlbumDateBounds } from "@emk/shared-contracts";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { getDesktopDatabase } from "./client";

const DEFAULT_PAGE_SIZE = 48;
const MAX_PAGE_SIZE = 200;
const BEST_OF_YEAR_MIN_STAR_RATING = 4;
const BEST_OF_YEAR_MIN_AESTHETIC_SCORE = 7;

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
  city: string;
  group_label: string;
  media_count: number;
}

interface SmartAlbumYearRow {
  year: string;
  media_count: number;
  top_star_rating: number | null;
  top_aesthetic_score: number | null;
  cover_source_path: string | null;
  cover_media_kind: "image" | "video" | null;
}

const AI_AESTHETIC_SCORE_SQL = `COALESCE(
  CAST(json_extract(ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
  CAST(json_extract(ai_metadata, '$.photo_estetic_quality') AS REAL)
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
  return {
    grouping: request?.grouping === "area-city" ? "area-city" : "year-city",
    source: request?.source === "non-gps" ? "non-gps" : "gps",
  };
}

export function listSmartAlbumPlaces(
  request?: SmartAlbumPlacesRequest,
  libraryId = DEFAULT_LIBRARY_ID,
): SmartAlbumPlacesResult {
  const normalizedRequest = normalizeSmartAlbumPlacesRequest(request);
  const groupExpression = normalizedRequest.grouping === "area-city"
    ? "COALESCE(NULLIF(TRIM(location_area), ''), 'Unknown area')"
    : "SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 4)";
  const groupPredicate = normalizedRequest.grouping === "area-city"
    ? "1 = 1"
    : "group_label GLOB '[0-9][0-9][0-9][0-9]'";
  const sourcePredicate = normalizedRequest.source === "gps"
    ? "location_source = 'gps'"
    : "(location_source IS NULL OR location_source <> 'gps')";
  const rows = getDesktopDatabase()
    .prepare(
      `WITH place_items AS (
         SELECT
           TRIM(country) AS country,
           TRIM(city) AS city,
           ${groupExpression} AS group_label
         FROM media_items
         WHERE library_id = ?
           AND deleted_at IS NULL
           AND ${sourcePredicate}
           AND NULLIF(TRIM(country), '') IS NOT NULL
           AND NULLIF(TRIM(city), '') IS NOT NULL
           AND TRIM(country) <> TRIM(city)
       ),
       place_counts AS (
         SELECT country, city, group_label, COUNT(*) AS media_count
         FROM place_items
         WHERE ${groupPredicate}
         GROUP BY country, city, group_label
       )
       SELECT pc.country, pc.city, pc.group_label, pc.media_count
       FROM place_counts pc
       ORDER BY pc.country COLLATE NOCASE ASC, pc.group_label DESC, pc.city COLLATE NOCASE ASC`,
    )
    .all(libraryId) as SmartAlbumPlaceRow[];

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
      id: `place:${normalizedRequest.source}:${normalizedRequest.grouping}:${row.country}:${row.group_label}:${row.city}`,
      country: row.country,
      city: row.city,
      group: row.group_label,
      label: row.city,
      mediaCount: row.media_count,
    });
    countries.set(row.country, existing);
  }
  return { countries: Array.from(countries.values()) };
}

export function listSmartAlbumYears(libraryId = DEFAULT_LIBRARY_ID): SmartAlbumYearsResult {
  const rows = getDesktopDatabase()
    .prepare(
      `WITH valid_items AS (
         SELECT
           star_rating,
           ${AI_AESTHETIC_SCORE_SQL} AS aesthetic_score,
           SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 4) AS year
         FROM media_items
         WHERE library_id = ?
           AND deleted_at IS NULL
           AND COALESCE(photo_taken_at, file_created_at) IS NOT NULL
           AND SUBSTR(COALESCE(photo_taken_at, file_created_at), 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
           AND (
             COALESCE(star_rating, 0) >= ${BEST_OF_YEAR_MIN_STAR_RATING}
             OR COALESCE(${AI_AESTHETIC_SCORE_SQL}, 0) >= ${BEST_OF_YEAR_MIN_AESTHETIC_SCORE}
           )
       )
       SELECT
         year,
         COUNT(*) AS media_count,
         MAX(star_rating) AS top_star_rating,
         MAX(aesthetic_score) AS top_aesthetic_score,
         NULL AS cover_source_path,
         NULL AS cover_media_kind
       FROM valid_items
       GROUP BY year
       ORDER BY year DESC`,
    )
    .all(libraryId) as SmartAlbumYearRow[];

  return {
    years: rows.map((row) => ({
      year: row.year,
      mediaCount: row.media_count,
      topStarRating: row.top_star_rating,
      topAestheticScore: row.top_aesthetic_score,
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
    const groupPredicate = request.grouping === "area-city"
      ? "COALESCE(NULLIF(TRIM(mi.location_area), ''), 'Unknown area') = ?"
      : "SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?";
    const total = db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM media_items mi
         WHERE mi.library_id = ?
           AND mi.deleted_at IS NULL
           AND ${sourcePredicate}
           AND TRIM(mi.country) = ?
           AND TRIM(mi.city) = ?
           AND ${groupPredicate}`,
      )
      .get(libraryId, request.country.trim(), request.city.trim(), request.group.trim()) as
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
           AND TRIM(mi.city) = ?
           AND ${groupPredicate}
         ORDER BY COALESCE(mi.photo_taken_at, mi.file_created_at) DESC, mi.source_path COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(
        libraryId,
        request.country.trim(),
        request.city.trim(),
        request.group.trim(),
        limit,
        offset,
      ) as AlbumItemRow[];
    return { rows: mapAlbumItemRows(rows), totalCount: total?.cnt ?? 0 };
  }

  const year = request.year.trim();
  const orderBy = request.randomize
    ? "RANDOM()"
    : `COALESCE(mi.star_rating, -1) DESC,
       COALESCE(
         CAST(json_extract(mi.ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
         CAST(json_extract(mi.ai_metadata, '$.photo_estetic_quality') AS REAL),
         -1
       ) DESC,
       COALESCE(mi.photo_taken_at, mi.file_created_at) DESC,
       mi.source_path COLLATE NOCASE ASC`;
  const total = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM media_items mi
       WHERE mi.library_id = ?
         AND mi.deleted_at IS NULL
         AND SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?
         AND (
           COALESCE(mi.star_rating, 0) >= ${BEST_OF_YEAR_MIN_STAR_RATING}
           OR COALESCE(
             CAST(json_extract(mi.ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
             CAST(json_extract(mi.ai_metadata, '$.photo_estetic_quality') AS REAL),
             0
           ) >= ${BEST_OF_YEAR_MIN_AESTHETIC_SCORE}
         )`,
    )
    .get(libraryId, year) as { cnt: number } | undefined;
  const rows = db
    .prepare(
      `SELECT mi.id, mi.source_path, mi.filename, mi.display_title, mi.media_kind, mi.star_rating, mi.width, mi.height
       FROM media_items mi
       WHERE mi.library_id = ?
         AND mi.deleted_at IS NULL
         AND SUBSTR(COALESCE(mi.photo_taken_at, mi.file_created_at), 1, 4) = ?
         AND (
           COALESCE(mi.star_rating, 0) >= ${BEST_OF_YEAR_MIN_STAR_RATING}
           OR COALESCE(
             CAST(json_extract(mi.ai_metadata, '$.image_analysis.photo_estetic_quality') AS REAL),
             CAST(json_extract(mi.ai_metadata, '$.photo_estetic_quality') AS REAL),
             0
           ) >= ${BEST_OF_YEAR_MIN_AESTHETIC_SCORE}
         )
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(libraryId, year, limit, offset) as AlbumItemRow[];
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
