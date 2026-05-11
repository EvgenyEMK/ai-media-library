import { randomUUID } from "node:crypto";
import path from "node:path";
import { getDesktopDatabase, getVectorBackendStatus } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { appendEventAndLocationPredicates } from "./media-item-sql-filters";
import { MULTIMODAL_EMBED_MODEL } from "../semantic-embeddings";

/** SQLite default SQLITE_MAX_VARIABLE_NUMBER is often 999; keep IN lists well under that (incl. fixed params). */
const INDEXED_PATHS_QUERY_CHUNK = 900;

export interface SemanticFilters {
  city?: string;
  country?: string;
  peopleDetectedMin?: number;
  peopleDetectedMax?: number;
  ageMin?: number;
  ageMax?: number;
  folderPath?: string;
  recursive?: boolean;
  personTagIds?: string[];
  includeUnconfirmedFaces?: boolean;
  eventDateStart?: string;
  eventDateEnd?: string;
  locationQuery?: string;
}

export interface SemanticSearchRow {
  mediaItemId: string;
  path: string;
  name: string;
  score: number;
  city: string | null;
  country: string | null;
  peopleDetected: number | null;
  ageMin: number | null;
  ageMax: number | null;
}

export interface MediaItemContext {
  id: string;
  aiMetadata: string | null;
}

export function ensureMediaItemForPath(
  filePath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): string | null {
  const db = getDesktopDatabase();
  const existing = db
    .prepare(`SELECT id FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`)
    .get(libraryId, filePath) as { id: string } | undefined;
  if (existing) {
    return existing.id;
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO media_items (
      id,
      library_id,
      source_path,
      filename,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, libraryId, filePath, path.basename(filePath), now, now);
  return id;
}

export function getMediaItemContextByPath(
  filePath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): MediaItemContext | null {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT id, ai_metadata
       FROM media_items
       WHERE library_id = ? AND source_path = ?
       LIMIT 1`,
    )
    .get(libraryId, filePath) as { id: string; ai_metadata: string | null } | undefined;
  if (!row) {
    return null;
  }
  return { id: row.id, aiMetadata: row.ai_metadata };
}

export function getIndexedImageMediaIdsByPaths(
  paths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
  modelVersion = MULTIMODAL_EMBED_MODEL,
): Set<string> {
  if (paths.length === 0) {
    return new Set<string>();
  }
  const db = getDesktopDatabase();
  const sqlPrefix = `SELECT mi.source_path
     FROM media_embeddings me
     INNER JOIN media_items mi ON mi.id = me.media_item_id
     WHERE me.library_id = ?
       AND mi.deleted_at IS NULL
       AND me.embedding_type = 'image'
       AND me.model_version = ?
       AND me.embedding_status = 'ready'
       AND mi.source_path IN (`;
  const sqlSuffix = `)`;
  const result = new Set<string>();
  for (let i = 0; i < paths.length; i += INDEXED_PATHS_QUERY_CHUNK) {
    const chunk = paths.slice(i, i + INDEXED_PATHS_QUERY_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, modelVersion, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      result.add(row.source_path);
    }
  }
  return result;
}

export function getFailedImageEmbeddingPaths(
  paths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
  modelVersion = MULTIMODAL_EMBED_MODEL,
): Set<string> {
  if (paths.length === 0) {
    return new Set<string>();
  }
  const db = getDesktopDatabase();
  const sqlPrefix = `SELECT mi.source_path
     FROM media_embeddings me
     INNER JOIN media_items mi ON mi.id = me.media_item_id
     WHERE me.library_id = ?
       AND mi.deleted_at IS NULL
       AND me.embedding_type = 'image'
       AND me.model_version = ?
       AND me.embedding_status = 'failed'
       AND mi.source_path IN (`;
  const sqlSuffix = `)`;
  const result = new Set<string>();
  for (let i = 0; i < paths.length; i += INDEXED_PATHS_QUERY_CHUNK) {
    const chunk = paths.slice(i, i + INDEXED_PATHS_QUERY_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, modelVersion, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      result.add(row.source_path);
    }
  }
  return result;
}

const vectorCache = new Map<string, Float32Array>();

export function clearVectorCache(): void {
  vectorCache.clear();
}

/** Cached VLM (`embedding_type = 'image'`) vector for an item, if this search populated the cache. */
export function getCachedImageVector(
  mediaItemId: string,
): Float32Array | undefined {
  return vectorCache.get(mediaItemId);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => { setImmediate(resolve); });
}

/**
 * Async version that yields to the event loop periodically so IPC responses
 * are not blocked while computing cosine similarity over thousands of rows.
 * Parsed vectors are cached in memory to speed up subsequent searches.
 */
export async function searchByVector(
  queryVector: number[],
  filters: SemanticFilters,
  limit = 30,
  libraryId = DEFAULT_LIBRARY_ID,
  modelVersion = MULTIMODAL_EMBED_MODEL,
): Promise<SemanticSearchRow[]> {
  const db = getDesktopDatabase();
  const where: string[] = ["mi.library_id = ?", "mi.deleted_at IS NULL"];
  const args: unknown[] = [libraryId];

  if (filters.city?.trim()) {
    where.push("LOWER(COALESCE(mi.city, '')) = LOWER(?)");
    args.push(filters.city.trim());
  }
  if (filters.country?.trim()) {
    where.push("LOWER(COALESCE(mi.country, '')) = LOWER(?)");
    args.push(filters.country.trim());
  }
  if (typeof filters.peopleDetectedMin === "number") {
    where.push("mi.people_detected IS NOT NULL AND mi.people_detected >= ?");
    args.push(filters.peopleDetectedMin);
  }
  if (typeof filters.peopleDetectedMax === "number") {
    where.push("mi.people_detected IS NOT NULL AND mi.people_detected <= ?");
    args.push(filters.peopleDetectedMax);
  }
  if (typeof filters.ageMin === "number") {
    where.push("mi.age_max IS NOT NULL AND mi.age_max >= ?");
    args.push(filters.ageMin);
  }
  if (typeof filters.ageMax === "number") {
    where.push("mi.age_min IS NOT NULL AND mi.age_min <= ?");
    args.push(filters.ageMax);
  }

  appendEventAndLocationPredicates(where, args, "mi", filters);

  // Folder path filter — use LIKE for both recursive and non-recursive (post-filter for exact folder).
  // Use '~' as ESCAPE char to avoid clashing with Windows backslash path separators.
  if (filters.folderPath) {
    const sep = path.sep;
    const folderPrefix = filters.folderPath.endsWith(sep)
      ? filters.folderPath
      : filters.folderPath + sep;
    where.push("mi.source_path LIKE ? ESCAPE '~'");
    args.push(folderPrefix.replace(/[%_~]/g, "~$&") + "%");
  }

  // Person tag filter — each selected tag must appear as a face instance on the image (AND semantics).
  // When includeUnconfirmedFaces is true, also accept media items that have an unconfirmed
  // suggestion row in media_item_person_suggestions above the stored threshold.
  if (filters.personTagIds && filters.personTagIds.length > 0) {
    const allowUnconfirmed = filters.includeUnconfirmedFaces === true;
    for (const tagId of filters.personTagIds) {
      if (allowUnconfirmed) {
        where.push(
          `(
            EXISTS (
              SELECT 1 FROM media_face_instances fi
              WHERE fi.media_item_id = mi.id
                AND fi.library_id = ?
                AND fi.tag_id = ?
            )
            OR EXISTS (
              SELECT 1 FROM media_item_person_suggestions ps
              WHERE ps.media_item_id = mi.id
                AND ps.library_id = ?
                AND ps.tag_id = ?
            )
          )`,
        );
        args.push(libraryId, tagId, libraryId, tagId);
      } else {
        where.push(
          `EXISTS (
            SELECT 1 FROM media_face_instances fi
            WHERE fi.media_item_id = mi.id
              AND fi.library_id = ?
              AND fi.tag_id = ?
          )`,
        );
        args.push(libraryId, tagId);
      }
    }
  }

  const rows = db
    .prepare(
      `SELECT
         mi.id as media_item_id,
         mi.source_path,
         mi.filename,
         mi.city,
         mi.country,
         mi.people_detected,
         mi.age_min,
         mi.age_max,
         me.vector_json
       FROM media_items mi
       INNER JOIN media_embeddings me ON me.media_item_id = mi.id
       WHERE ${where.join(" AND ")}
         AND me.library_id = ?
         AND me.embedding_type = 'image'
         AND me.model_version = ?
         AND me.embedding_status = 'ready'`,
    )
    .all(...args, libraryId, modelVersion) as Array<{
    media_item_id: string;
    source_path: string;
    filename: string;
    city: string | null;
    country: string | null;
    people_detected: number | null;
    age_min: number | null;
    age_max: number | null;
    vector_json: string;
  }>;

  // For non-recursive folder filter, narrow down to the immediate folder in JS
  // (SQL LIKE already filtered to the folder prefix; now exclude deeper sub-paths)
  const filteredRows = (filters.folderPath && !filters.recursive)
    ? rows.filter((row) => path.dirname(row.source_path) === filters.folderPath)
    : rows;

  const CHUNK_SIZE = 200;
  const queryVec = new Float32Array(queryVector);
  const results: SemanticSearchRow[] = [];

  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];
    let vec = vectorCache.get(row.media_item_id);
    if (!vec) {
      const parsed = parseVector(row.vector_json);
      if (!parsed || parsed.length !== queryVector.length) continue;
      vec = new Float32Array(parsed);
      vectorCache.set(row.media_item_id, vec);
    }
    results.push({
      mediaItemId: row.media_item_id,
      path: row.source_path,
      name: row.filename,
      score: cosineSimilarityTyped(queryVec, vec),
      city: row.city,
      country: row.country,
      peopleDetected: row.people_detected,
      ageMin: row.age_min,
      ageMax: row.age_max,
    });

    if ((i + 1) % CHUNK_SIZE === 0 && i + 1 < filteredRows.length) {
      await yieldToEventLoop();
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, Math.max(1, limit));
}

const MAX_SIMILAR_NEIGHBORS = 99;
const MAX_SIMILAR_RESULTS_WITH_SOURCE = MAX_SIMILAR_NEIGHBORS + 1;

type SimilarImageDbRow = {
  media_item_id: string;
  source_path: string;
  filename: string;
  city: string | null;
  country: string | null;
  people_detected: number | null;
  age_min: number | null;
  age_max: number | null;
};

function semanticRowFromDbRow(row: SimilarImageDbRow, score: number): SemanticSearchRow {
  return {
    mediaItemId: row.media_item_id,
    path: row.source_path,
    name: row.filename,
    score,
    city: row.city,
    country: row.country,
    peopleDetected: row.people_detected,
    ageMin: row.age_min,
    ageMax: row.age_max,
  };
}

/**
 * Global image-to-image similarity using stored VLM embeddings (`embedding_type = image`).
 * Uses sqlite-vec KNN when available so the main process does not parse every vector into JS.
 * Falls back to the classic full-library scan only when sqlite-vec is unavailable.
 */
export async function searchSimilarImagesBySourcePath(
  sourcePath: string,
  minSimilarity: number,
  libraryId = DEFAULT_LIBRARY_ID,
  modelVersion = MULTIMODAL_EMBED_MODEL,
): Promise<
  | { ok: true; results: SemanticSearchRow[] }
  | { ok: false; error: string }
> {
  if (!Number.isFinite(minSimilarity) || minSimilarity <= 0 || minSimilarity > 1) {
    return { ok: false, error: "Invalid similarity threshold." };
  }

  const db = getDesktopDatabase();
  const source = db
    .prepare(
      `SELECT
         mi.id AS media_item_id,
         mi.source_path,
         mi.filename,
         mi.city,
         mi.country,
         mi.people_detected,
         mi.age_min,
         mi.age_max,
         me.vector_json
       FROM media_items mi
       INNER JOIN media_embeddings me ON me.media_item_id = mi.id
       WHERE mi.library_id = ?
         AND mi.deleted_at IS NULL
         AND mi.source_path = ?
         AND me.library_id = ?
         AND me.embedding_type = 'image'
         AND me.model_version = ?
         AND me.embedding_status = 'ready'
       LIMIT 1`,
    )
    .get(libraryId, sourcePath, libraryId, modelVersion) as
      | {
          media_item_id: string;
          source_path: string;
          filename: string;
          city: string | null;
          country: string | null;
          people_detected: number | null;
          age_min: number | null;
          age_max: number | null;
          vector_json: string;
        }
      | undefined;

  if (!source) {
    return {
      ok: false,
      error: "Image is not indexed for AI search yet. Index images for this library first.",
    };
  }

  const sourceParsed = parseVector(source.vector_json);
  if (!sourceParsed) {
    return { ok: false, error: "Could not read image embedding." };
  }
  const queryVec = new Float32Array(sourceParsed);
  const sourceId = source.media_item_id;
  const sourceResult = semanticRowFromDbRow(source, 1);

  if (getVectorBackendStatus().activeMode === "sqlite-vec") {
    try {
      const queryVectorJson = JSON.stringify(sourceParsed);
      const rows = db
        .prepare(
          `SELECT
             mi.id as media_item_id,
             mi.source_path,
             mi.filename,
             mi.city,
             mi.country,
             mi.people_detected,
             mi.age_min,
             mi.age_max,
             vec_distance_cosine(me.vector_json, ?) AS distance
           FROM media_embeddings me
           INNER JOIN media_items mi ON mi.id = me.media_item_id
           WHERE mi.library_id = ?
             AND mi.deleted_at IS NULL
             AND me.library_id = ?
             AND me.embedding_type = 'image'
             AND me.model_version = ?
             AND me.embedding_status = 'ready'
           ORDER BY distance ASC
           LIMIT ?`,
        )
        .all(queryVectorJson, libraryId, libraryId, modelVersion, MAX_SIMILAR_RESULTS_WITH_SOURCE) as Array<
          SimilarImageDbRow & { distance: number | null }
        >;

      const neighbors = rows
        .filter(
          (row) =>
            row.media_item_id !== sourceId &&
            typeof row.distance === "number" &&
            Number.isFinite(row.distance),
        )
        .map((row) => semanticRowFromDbRow(row, Math.max(-1, Math.min(1, 1 - Number(row.distance)))))
        .filter((row) => row.score >= minSimilarity)
        .slice(0, MAX_SIMILAR_NEIGHBORS);

      return { ok: true, results: [sourceResult, ...neighbors] };
    } catch {
      // Fall back to the classic JS cosine scan when sqlite-vec is not loadable at runtime.
    }
  }

  const where: string[] = ["mi.library_id = ?", "mi.deleted_at IS NULL"];
  const args: unknown[] = [libraryId];

  const rows = db
    .prepare(
      `SELECT
         mi.id as media_item_id,
         mi.source_path,
         mi.filename,
         mi.city,
         mi.country,
         mi.people_detected,
         mi.age_min,
         mi.age_max,
         me.vector_json
       FROM media_items mi
       INNER JOIN media_embeddings me ON me.media_item_id = mi.id
       WHERE ${where.join(" AND ")}
         AND me.library_id = ?
         AND me.embedding_type = 'image'
         AND me.model_version = ?
         AND me.embedding_status = 'ready'`,
    )
    .all(...args, libraryId, modelVersion) as Array<{
    media_item_id: string;
    source_path: string;
    filename: string;
    city: string | null;
    country: string | null;
    people_detected: number | null;
    age_min: number | null;
    age_max: number | null;
    vector_json: string;
  }>;

  const scored: SemanticSearchRow[] = [];
  const CHUNK_SIZE = 200;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (i > 0 && i % CHUNK_SIZE === 0) {
      await yieldToEventLoop();
    }
    if (row.media_item_id === sourceId) {
      continue;
    }
    const parsed = parseVector(row.vector_json);
    if (!parsed || parsed.length !== sourceParsed.length) {
      continue;
    }
    const vec = new Float32Array(parsed);
    const score = cosineSimilarityTyped(queryVec, vec);
    if (score < minSimilarity) {
      continue;
    }
    scored.push({
      ...semanticRowFromDbRow(row, score),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const neighbors = scored.slice(0, MAX_SIMILAR_NEIGHBORS);

  return { ok: true, results: [sourceResult, ...neighbors] };
}

function parseVector(value: string): number[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "number")) {
      return null;
    }
    return parsed as number[];
  } catch {
    return null;
  }
}

function cosineSimilarityTyped(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const descriptionVectorCache = new Map<string, Float32Array>();

export function clearDescriptionVectorCache(): void {
  descriptionVectorCache.clear();
}

export function getCachedDescriptionVector(
  mediaItemId: string,
): Float32Array | undefined {
  return descriptionVectorCache.get(mediaItemId);
}

/**
 * Searches description text embeddings (embedding_type = 'text') against the
 * query vector.  Same filter logic as searchByVector but over a different
 * embedding type.
 */
export async function searchByDescriptionVector(
  queryVector: number[],
  filters: SemanticFilters,
  limit = 30,
  libraryId = DEFAULT_LIBRARY_ID,
  modelVersion = MULTIMODAL_EMBED_MODEL,
): Promise<SemanticSearchRow[]> {
  const db = getDesktopDatabase();
  const where: string[] = ["mi.library_id = ?", "mi.deleted_at IS NULL"];
  const args: unknown[] = [libraryId];

  appendEventAndLocationPredicates(where, args, "mi", filters);

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

  const rows = db
    .prepare(
      `SELECT
         mi.id as media_item_id,
         mi.source_path,
         mi.filename,
         mi.city,
         mi.country,
         mi.people_detected,
         mi.age_min,
         mi.age_max,
         me.vector_json
       FROM media_items mi
       INNER JOIN media_embeddings me ON me.media_item_id = mi.id
       WHERE ${where.join(" AND ")}
         AND me.library_id = ?
         AND me.embedding_type = 'text'
         AND me.model_version = ?
         AND me.embedding_status = 'ready'`,
    )
    .all(...args, libraryId, modelVersion) as Array<{
    media_item_id: string;
    source_path: string;
    filename: string;
    city: string | null;
    country: string | null;
    people_detected: number | null;
    age_min: number | null;
    age_max: number | null;
    vector_json: string;
  }>;

  const filteredRows = (filters.folderPath && !filters.recursive)
    ? rows.filter((row) => path.dirname(row.source_path) === filters.folderPath)
    : rows;

  const CHUNK_SIZE = 200;
  const queryVec = new Float32Array(queryVector);
  const results: SemanticSearchRow[] = [];

  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];
    let vec = descriptionVectorCache.get(row.media_item_id);
    if (!vec) {
      const parsed = parseVector(row.vector_json);
      if (!parsed || parsed.length !== queryVector.length) continue;
      vec = new Float32Array(parsed);
      descriptionVectorCache.set(row.media_item_id, vec);
    }
    results.push({
      mediaItemId: row.media_item_id,
      path: row.source_path,
      name: row.filename,
      score: cosineSimilarityTyped(queryVec, vec),
      city: row.city,
      country: row.country,
      peopleDetected: row.people_detected,
      ageMin: row.age_min,
      ageMax: row.age_max,
    });

    if ((i + 1) % CHUNK_SIZE === 0 && i + 1 < filteredRows.length) {
      await yieldToEventLoop();
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, Math.max(1, limit));
}
