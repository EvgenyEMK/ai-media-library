import {
  DEFAULT_FACE_DETECTION_SETTINGS,
  type ClusterPersonCentroidMatchStats,
} from "../../src/shared/ipc";
import { getDesktopDatabase, getVectorBackendStatus } from "./client";
import { FACE_BBOX_REF_HEIGHT_SQL, FACE_BBOX_REF_WIDTH_SQL } from "./face-instance-display-dimensions";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

/** Legacy rows may have embedding_json filled before embedding_status was backfilled. */
const SQL_FI_EMBEDDING_USABLE = `fi.embedding_json IS NOT NULL AND (fi.embedding_status = 'ready' OR fi.embedding_status IS NULL)`;

export interface FaceForEmbeddingJob {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  landmarks_json: string;
}

export interface SimilarFaceMatch {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  tagId: string | null;
  tagLabel: string | null;
  score: number;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export function upsertFaceEmbedding(
  faceInstanceId: string,
  embedding: number[],
  model: string,
  dimension: number,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_face_instances
     SET embedding_json = ?,
         embedding_model = ?,
         embedding_dimension = ?,
         embedding_status = 'ready',
         updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(
    JSON.stringify(embedding),
    model,
    dimension,
    now,
    faceInstanceId,
    libraryId,
  );
}

export function markFaceEmbeddingStatus(
  faceInstanceId: string,
  status: "pending" | "indexing" | "failed",
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_face_instances
     SET embedding_status = ?, updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(status, now, faceInstanceId, libraryId);
}

export function getFacesNeedingEmbeddings(
  libraryId = DEFAULT_LIBRARY_ID,
  folderPath?: string,
): FaceForEmbeddingJob[] {
  const db = getDesktopDatabase();

  const whereClause = folderPath
    ? `AND mi.source_path LIKE ? || '%'`
    : "";
  const params: unknown[] = [libraryId];
  if (folderPath) {
    const normalized = folderPath.replace(/[\\/]$/, "") + "\\";
    params.push(normalized);
  }

  const rows = db
    .prepare(
      `SELECT
         fi.id AS face_instance_id,
         fi.media_item_id,
         mi.source_path,
         fi.bbox_x,
         fi.bbox_y,
         fi.bbox_width,
         fi.bbox_height,
         fi.landmarks_json
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.library_id = ?
         AND mi.deleted_at IS NULL
         AND fi.landmarks_json IS NOT NULL
         AND (fi.embedding_json IS NULL OR fi.embedding_status = 'failed')
         ${whereClause}
       ORDER BY mi.source_path, fi.rowid`,
    )
    .all(...params) as Array<{
    face_instance_id: string;
    media_item_id: string;
    source_path: string;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
    landmarks_json: string;
  }>;

  return rows.map((row) => ({
    faceInstanceId: row.face_instance_id,
    mediaItemId: row.media_item_id,
    sourcePath: row.source_path,
    bbox_x: row.bbox_x,
    bbox_y: row.bbox_y,
    bbox_width: row.bbox_width,
    bbox_height: row.bbox_height,
    landmarks_json: row.landmarks_json,
  }));
}

export interface FaceNeedingCrop {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
}

export function getFacesNeedingCrops(
  libraryId = DEFAULT_LIBRARY_ID,
): FaceNeedingCrop[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT
         fi.id AS face_instance_id,
         fi.media_item_id,
         mi.source_path,
         fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.library_id = ?
         AND mi.deleted_at IS NULL
         AND fi.crop_path IS NULL
       ORDER by mi.source_path, fi.rowid`,
    )
    .all(libraryId) as Array<{
    face_instance_id: string;
    media_item_id: string;
    source_path: string;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
  }>;

  return rows.map((row) => ({
    faceInstanceId: row.face_instance_id,
    mediaItemId: row.media_item_id,
    sourcePath: row.source_path,
    bbox_x: row.bbox_x,
    bbox_y: row.bbox_y,
    bbox_width: row.bbox_width,
    bbox_height: row.bbox_height,
  }));
}

export interface FacePersonTagSuggestion {
  tagId: string;
  tagLabel: string;
  score: number;
}

/** Cosine similarity vs a person centroid (same metric as findMatchesForPerson / People sidebar). */
const DEFAULT_CENTROID_SUGGEST_THRESHOLD = 0.48;

function suggestPersonTagAgainstPersonCentroids(
  faceVector: number[],
  libraryId: string,
  threshold: number,
): FacePersonTagSuggestion | null {
  const db = getDesktopDatabase();
  const tagRows = db
    .prepare(
      `SELECT DISTINCT fi.tag_id AS tag_id, mt.name AS tag_label
       FROM media_face_instances fi
       INNER JOIN media_tags mt ON mt.id = fi.tag_id
       WHERE fi.library_id = ?
         AND fi.tag_id IS NOT NULL
         AND ${SQL_FI_EMBEDDING_USABLE}`,
    )
    .all(libraryId) as Array<{ tag_id: string; tag_label: string }>;

  let best: FacePersonTagSuggestion | null = null;

  for (const row of tagRows) {
    const centroid =
      getPersonCentroid(row.tag_id)?.centroid ??
      computePersonCentroid(row.tag_id, libraryId)?.centroid;
    if (!centroid || centroid.length !== faceVector.length) {
      continue;
    }

    const score = cosineSimilarity(faceVector, centroid);
    if (score < threshold) {
      continue;
    }
    if (!best || score > best.score) {
      best = { tagId: row.tag_id, tagLabel: row.tag_label, score };
    }
  }

  return best;
}

/**
 * Best person tag for an untagged face using cosine similarity between this face's
 * embedding and each person's centroid only (no face-to-face match). Same definition
 * as the reverse search in findMatchesForPerson (centroid vs untagged face).
 */
export function suggestPersonTagForFaceInstance(
  faceInstanceId: string,
  options: { threshold?: number; libraryId?: string } = {},
): FacePersonTagSuggestion | null {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold = options.threshold ?? DEFAULT_CENTROID_SUGGEST_THRESHOLD;

  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT embedding_json FROM media_face_instances
       WHERE id = ? AND library_id = ?
         AND embedding_json IS NOT NULL
         AND (embedding_status = 'ready' OR embedding_status IS NULL)`,
    )
    .get(faceInstanceId, libraryId) as { embedding_json: string } | undefined;

  if (!row) {
    return null;
  }

  const queryVector = parseVector(row.embedding_json);
  if (!queryVector) {
    return null;
  }

  return suggestPersonTagAgainstPersonCentroids(queryVector, libraryId, threshold);
}

export function searchSimilarFaces(
  queryVector: number[],
  threshold: number,
  limit: number,
  options: {
    excludeTagged?: boolean;
    /** When true, only faces already assigned to a person tag are considered. */
    taggedOnly?: boolean;
    excludeFaceIds?: string[];
    libraryId?: string;
  } = {},
): SimilarFaceMatch[] {
  const db = getDesktopDatabase();
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const backend = getVectorBackendStatus();

  if (backend.activeMode === "sqlite-vec") {
    try {
      return searchWithSqliteVec(
        db,
        queryVector,
        threshold,
        limit,
        libraryId,
        options,
      );
    } catch {
      // Fall through to classic search
    }
  }

  return searchWithClassicCosine(
    db,
    queryVector,
    threshold,
    limit,
    libraryId,
    options,
  );
}

function searchWithSqliteVec(
  db: ReturnType<typeof getDesktopDatabase>,
  queryVector: number[],
  threshold: number,
  limit: number,
  libraryId: string,
  options: {
    excludeTagged?: boolean;
    taggedOnly?: boolean;
    excludeFaceIds?: string[];
  },
): SimilarFaceMatch[] {
  const queryVectorJson = JSON.stringify(queryVector);

  let extraWhere = "";
  if (options.excludeTagged) {
    extraWhere += " AND fi.tag_id IS NULL";
  }
  if (options.taggedOnly) {
    extraWhere += " AND fi.tag_id IS NOT NULL";
  }
  if (options.excludeFaceIds && options.excludeFaceIds.length > 0) {
    const placeholders = options.excludeFaceIds.map(() => "?").join(", ");
    extraWhere += ` AND fi.id NOT IN (${placeholders})`;
  }

  const params: unknown[] = [
    queryVectorJson,
    libraryId,
  ];
  if (options.excludeFaceIds && options.excludeFaceIds.length > 0) {
    params.push(...options.excludeFaceIds);
  }
  /** Large KNN cap when `limit <= 0` (return all above threshold, best-effort for sqlite-vec). */
  const knnLimit = limit <= 0 ? 500_000 : Math.min(limit, 500_000);
  params.push(knnLimit);

  const rows = db
    .prepare(
      `SELECT
         fi.id AS face_instance_id,
         fi.media_item_id,
         mi.source_path,
         fi.tag_id,
         t.name AS tag_label,
         fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
         ${FACE_BBOX_REF_WIDTH_SQL} AS image_width, ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height,
         vec_distance_cosine(fi.embedding_json, ?) AS distance
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       LEFT JOIN media_tags t ON t.id = fi.tag_id
       WHERE fi.library_id = ?
         AND mi.deleted_at IS NULL
         AND ${SQL_FI_EMBEDDING_USABLE}
         ${extraWhere}
       ORDER BY distance ASC
       LIMIT ?`,
    )
    .all(...params) as Array<{
    face_instance_id: string;
    media_item_id: string;
    source_path: string;
    tag_id: string | null;
    tag_label: string | null;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
    image_width: number | null;
    image_height: number | null;
    distance: number | null;
  }>;

  return rows
    .filter(
      (row) =>
        typeof row.distance === "number" &&
        Number.isFinite(row.distance) &&
        1 - row.distance >= threshold,
    )
    .map((row) => ({
      faceInstanceId: row.face_instance_id,
      mediaItemId: row.media_item_id,
      sourcePath: row.source_path,
      tagId: row.tag_id,
      tagLabel: row.tag_label,
      score: Math.max(-1, Math.min(1, 1 - Number(row.distance))),
      bboxX: row.bbox_x,
      bboxY: row.bbox_y,
      bboxWidth: row.bbox_width,
      bboxHeight: row.bbox_height,
      imageWidth: row.image_width,
      imageHeight: row.image_height,
    }));
}

function searchWithClassicCosine(
  db: ReturnType<typeof getDesktopDatabase>,
  queryVector: number[],
  threshold: number,
  limit: number,
  libraryId: string,
  options: {
    excludeTagged?: boolean;
    taggedOnly?: boolean;
    excludeFaceIds?: string[];
  },
): SimilarFaceMatch[] {
  let extraWhere = "";
  if (options.excludeTagged) {
    extraWhere += " AND fi.tag_id IS NULL";
  }
  if (options.taggedOnly) {
    extraWhere += " AND fi.tag_id IS NOT NULL";
  }

  const excludeSet = new Set(options.excludeFaceIds ?? []);

  const rows = db
    .prepare(
      `SELECT
         fi.id AS face_instance_id,
         fi.media_item_id,
         mi.source_path,
         fi.tag_id,
         t.name AS tag_label,
         fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
         ${FACE_BBOX_REF_WIDTH_SQL} AS image_width, ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height,
         fi.embedding_json
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       LEFT JOIN media_tags t ON t.id = fi.tag_id
       WHERE fi.library_id = ?
         AND mi.deleted_at IS NULL
         AND ${SQL_FI_EMBEDDING_USABLE}
         ${extraWhere}`,
    )
    .all(libraryId) as Array<{
    face_instance_id: string;
    media_item_id: string;
    source_path: string;
    tag_id: string | null;
    tag_label: string | null;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
    image_width: number | null;
    image_height: number | null;
    embedding_json: string;
  }>;

  const scored = rows
    .filter((row) => !excludeSet.has(row.face_instance_id))
    .map((row) => {
      const vector = parseVector(row.embedding_json);
      if (!vector || vector.length !== queryVector.length) {
        return null;
      }
      return {
        faceInstanceId: row.face_instance_id,
        mediaItemId: row.media_item_id,
        sourcePath: row.source_path,
        tagId: row.tag_id,
        tagLabel: row.tag_label,
        score: cosineSimilarity(queryVector, vector),
        bboxX: row.bbox_x,
        bboxY: row.bbox_y,
        bboxWidth: row.bbox_width,
        bboxHeight: row.bbox_height,
        imageWidth: row.image_width,
        imageHeight: row.image_height,
      };
    })
    .filter(
      (item): item is SimilarFaceMatch =>
        item !== null && item.score >= threshold,
    )
    .sort((a, b) => b.score - a.score);

  if (limit <= 0) {
    return scored;
  }
  return scored.slice(0, limit);
}

export function computePersonCentroid(
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): { centroid: number[]; sampleCount: number } | null {
  const db = getDesktopDatabase();

  const rows = db
    .prepare(
      `SELECT fi.embedding_json
       FROM media_face_instances fi
       WHERE fi.library_id = ?
         AND fi.tag_id = ?
         AND ${SQL_FI_EMBEDDING_USABLE}`,
    )
    .all(libraryId, tagId) as Array<{ embedding_json: string }>;

  if (rows.length === 0) {
    return null;
  }

  const vectors = rows
    .map((row) => parseVector(row.embedding_json))
    .filter((v): v is number[] => v !== null);

  if (vectors.length === 0) {
    return null;
  }

  const dim = vectors[0].length;
  const sum = new Float64Array(dim);
  for (const vec of vectors) {
    if (vec.length !== dim) {
      continue;
    }
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }

  const centroid = Array.from(sum).map((v) => v / vectors.length);

  // L2-normalize
  let norm = 0;
  for (const v of centroid) {
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] /= norm;
    }
  }

  return { centroid, sampleCount: vectors.length };
}

export function upsertPersonCentroid(
  tagId: string,
  centroid: number[],
  model: string,
  dimension: number,
  sampleCount: number,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO person_centroids (
       tag_id, library_id, embedding_model, embedding_dimension,
       centroid_json, sample_count, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tag_id) DO UPDATE SET
       embedding_model = excluded.embedding_model,
       embedding_dimension = excluded.embedding_dimension,
       centroid_json = excluded.centroid_json,
       sample_count = excluded.sample_count,
       updated_at = excluded.updated_at`,
  ).run(
    tagId,
    libraryId,
    model,
    dimension,
    JSON.stringify(centroid),
    sampleCount,
    now,
  );
}

export function deletePersonCentroid(tagId: string): void {
  const db = getDesktopDatabase();
  db.prepare("DELETE FROM person_centroids WHERE tag_id = ?").run(tagId);
}

export function getPersonCentroid(
  tagId: string,
): { centroid: number[]; model: string; dimension: number; sampleCount: number } | null {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT centroid_json, embedding_model, embedding_dimension, sample_count
       FROM person_centroids
       WHERE tag_id = ?`,
    )
    .get(tagId) as {
    centroid_json: string;
    embedding_model: string;
    embedding_dimension: number;
    sample_count: number;
  } | undefined;

  if (!row) {
    return null;
  }

  const centroid = parseVector(row.centroid_json);
  if (!centroid) {
    return null;
  }

  return {
    centroid,
    model: row.embedding_model,
    dimension: row.embedding_dimension,
    sampleCount: row.sample_count,
  };
}

/**
 * Cosine similarity of each face embedding to the given person's centroid
 * (same metric as findMatchesForPerson / Tagged faces auto-matches).
 */
export function getFaceToPersonCentroidSimilarities(
  faceInstanceIds: string[],
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, number> {
  if (faceInstanceIds.length === 0) {
    return {};
  }

  const centroidData = getPersonCentroid(tagId) ?? computePersonCentroid(tagId, libraryId);
  if (!centroidData) {
    return {};
  }

  const centroid = centroidData.centroid;
  const db = getDesktopDatabase();
  const placeholders = faceInstanceIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, embedding_json
       FROM media_face_instances
       WHERE library_id = ?
         AND id IN (${placeholders})
         AND embedding_json IS NOT NULL
         AND (embedding_status = 'ready' OR embedding_status IS NULL)`,
    )
    .all(libraryId, ...faceInstanceIds) as Array<{ id: string; embedding_json: string }>;

  const result: Record<string, number> = {};
  for (const row of rows) {
    const vec = parseVector(row.embedding_json);
    if (vec && vec.length === centroid.length) {
      result[row.id] = cosineSimilarity(vec, centroid);
    }
  }
  return result;
}

export function findMatchesForPerson(
  tagId: string,
  options: {
    threshold?: number;
    limit?: number;
    libraryId?: string;
  } = {},
): SimilarFaceMatch[] {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const centroidData = getPersonCentroid(tagId) ?? computePersonCentroid(tagId, libraryId);
  if (!centroidData) {
    return [];
  }

  const threshold = options.threshold ?? 0.6;
  /** Pass `limit: 0` to return all matches above threshold (within sqlite-vec KNN cap). */
  const limit = options.limit ?? 50;

  const taggedFaceIds = getTaggedFaceIds(tagId, libraryId);

  return searchSimilarFaces(centroidData.centroid, threshold, limit, {
    excludeTagged: true,
    excludeFaceIds: taggedFaceIds,
    libraryId,
  });
}

/**
 * Count of untagged face instances ≥ threshold vs the person's centroid.
 * Matches `findMatchesForPerson(..., { limit: 0 }).length` and the number shown in People / Tagged faces.
 */
export function countSimilarUntaggedFacesForPerson(
  tagId: string,
  options: { threshold?: number; libraryId?: string } = {},
): number {
  return findMatchesForPerson(tagId, { ...options, limit: 0 }).length;
}

/**
 * For Untagged clusters: per-cluster counts using the same centroid + threshold metric as
 * `findMatchesForPerson`, scoped to faces still in the cluster (not library-wide).
 */
export function getClusterPersonCentroidMatchStatsBatch(
  items: Array<{ clusterId: string; tagId: string }>,
  options: { threshold?: number; libraryId?: string } = {},
): Record<string, ClusterPersonCentroidMatchStats> {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold =
    options.threshold ?? DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold;
  const lowThreshold = Math.max(0, threshold - 0.1);

  const out: Record<string, ClusterPersonCentroidMatchStats> = {};

  const byTag = new Map<string, Set<string>>();
  for (const { clusterId, tagId } of items) {
    if (!clusterId || !tagId) continue;
    let set = byTag.get(tagId);
    if (!set) {
      set = new Set();
      byTag.set(tagId, set);
    }
    set.add(clusterId);
  }

  for (const [tagId, clusterIdSet] of byTag) {
    const uniqueClusterIds = Array.from(clusterIdSet);
    if (uniqueClusterIds.length === 0) continue;

    const centroidData = getPersonCentroid(tagId) ?? computePersonCentroid(tagId, libraryId);
    if (!centroidData) {
      for (const cid of uniqueClusterIds) {
        out[cid] = { memberCount: 0, matchingCount: 0, midBandCount: 0, belowMidCount: 0 };
      }
      continue;
    }

    const centroid = centroidData.centroid;
    const db = getDesktopDatabase();
    const placeholders = uniqueClusterIds.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT fi.cluster_id AS cluster_id, fi.embedding_json
         FROM media_face_instances fi
         INNER JOIN media_items mi ON mi.id = fi.media_item_id
         WHERE fi.library_id = ?
           AND fi.cluster_id IN (${placeholders})
           AND fi.tag_id IS NULL
           AND mi.deleted_at IS NULL
           AND ${SQL_FI_EMBEDDING_USABLE}`,
      )
      .all(libraryId, ...uniqueClusterIds) as Array<{
      cluster_id: string;
      embedding_json: string;
    }>;

    const stats = new Map<string, ClusterPersonCentroidMatchStats>();
    for (const cid of uniqueClusterIds) {
      stats.set(cid, { memberCount: 0, matchingCount: 0, midBandCount: 0, belowMidCount: 0 });
    }

    for (const row of rows) {
      const entry = stats.get(row.cluster_id);
      if (!entry) continue;
      entry.memberCount += 1;
      const vec = parseVector(row.embedding_json);
      let sim = -1;
      if (vec !== null && vec.length === centroid.length) {
        sim = cosineSimilarity(centroid, vec);
      }
      if (sim >= threshold) {
        entry.matchingCount += 1;
      } else if (sim >= lowThreshold) {
        entry.midBandCount += 1;
      } else {
        entry.belowMidCount += 1;
      }
    }

    for (const cid of uniqueClusterIds) {
      out[cid] =
        stats.get(cid) ?? { memberCount: 0, matchingCount: 0, midBandCount: 0, belowMidCount: 0 };
    }
  }

  return out;
}

export type ClusterPersonMemberSimilarityFilterMode = "matching" | "mid" | "below";

/**
 * Untagged face instance IDs in the cluster with usable embeddings, partitioned by centroid
 * cosine vs threshold bands (same rules as {@link getClusterPersonCentroidMatchStatsBatch}).
 * Within each band, IDs are sorted by similarity descending (then id) for display/pagination.
 */
export function getClusterMemberFaceIdsForPersonSimilarityFilter(
  clusterId: string,
  tagId: string,
  mode: ClusterPersonMemberSimilarityFilterMode,
  options: { threshold?: number; libraryId?: string } = {},
): string[] {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold =
    options.threshold ?? DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold;
  const lowThreshold = Math.max(0, threshold - 0.1);

  if (!clusterId || !tagId) {
    return [];
  }

  const centroidData = getPersonCentroid(tagId) ?? computePersonCentroid(tagId, libraryId);
  if (!centroidData) {
    return [];
  }

  const centroid = centroidData.centroid;
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT fi.id AS face_instance_id, fi.embedding_json
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.library_id = ?
         AND fi.cluster_id = ?
         AND fi.tag_id IS NULL
         AND mi.deleted_at IS NULL
         AND ${SQL_FI_EMBEDDING_USABLE}`,
    )
    .all(libraryId, clusterId) as Array<{
    face_instance_id: string;
    embedding_json: string;
  }>;

  const scored: Array<{ id: string; sim: number }> = [];
  for (const row of rows) {
    const vec = parseVector(row.embedding_json);
    let sim = -1;
    if (vec !== null && vec.length === centroid.length) {
      sim = cosineSimilarity(centroid, vec);
    }
    scored.push({ id: row.face_instance_id, sim });
  }

  const pickSorted = (pred: (sim: number) => boolean): string[] =>
    scored
      .filter((s) => pred(s.sim))
      .sort((a, b) => b.sim - a.sim || a.id.localeCompare(b.id))
      .map((s) => s.id);

  if (mode === "matching") {
    return pickSorted((sim) => sim >= threshold);
  }
  if (mode === "mid") {
    return pickSorted((sim) => sim >= lowThreshold && sim < threshold);
  }
  return pickSorted((sim) => sim < lowThreshold);
}

export function recomputeAndStoreCentroid(
  tagId: string,
  model: string,
  dimension: number,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const result = computePersonCentroid(tagId, libraryId);
  if (result) {
    upsertPersonCentroid(
      tagId,
      result.centroid,
      model,
      dimension,
      result.sampleCount,
      libraryId,
    );
  } else {
    deletePersonCentroid(tagId);
  }
}

export function getEmbeddingStats(
  libraryId = DEFAULT_LIBRARY_ID,
): {
  totalFaces: number;
  withEmbeddings: number;
  withLandmarks: number;
  pending: number;
} {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total_faces,
         SUM(CASE WHEN embedding_status = 'ready' THEN 1 ELSE 0 END) AS with_embeddings,
         SUM(CASE WHEN landmarks_json IS NOT NULL THEN 1 ELSE 0 END) AS with_landmarks,
         SUM(CASE WHEN landmarks_json IS NOT NULL AND (embedding_json IS NULL OR embedding_status = 'failed') THEN 1 ELSE 0 END) AS pending
       FROM media_face_instances
       WHERE library_id = ?`,
    )
    .get(libraryId) as {
    total_faces: number;
    with_embeddings: number;
    with_landmarks: number;
    pending: number;
  };

  return {
    totalFaces: row.total_faces,
    withEmbeddings: row.with_embeddings,
    withLandmarks: row.with_landmarks,
    pending: row.pending,
  };
}

function getTaggedFaceIds(
  tagId: string,
  libraryId: string,
): string[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT id FROM media_face_instances
       WHERE library_id = ? AND tag_id = ?`,
    )
    .all(libraryId, tagId) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

function parseVector(value: string): number[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== "number")
    ) {
      return null;
    }
    return parsed as number[];
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
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
