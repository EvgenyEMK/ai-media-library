/**
 * Agglomerative face clustering using cosine similarity.
 *
 * Groups untagged face embeddings into clusters of visually similar faces,
 * enabling "who is this person?" UI workflows similar to Apple/Google Photos.
 */

import { randomUUID } from "node:crypto";
import { getDesktopDatabase } from "./db/client";
import {
  FACE_BBOX_REF_HEIGHT_SQL,
  FACE_BBOX_REF_WIDTH_SQL,
} from "./db/face-instance-display-dimensions";
import { DEFAULT_LIBRARY_ID } from "./db/folder-analysis-status";
import { logUntaggedLoadMain, shouldLogUntaggedLoadMain } from "./debug/untagged-load-log";

const DEFAULT_SIMILARITY_THRESHOLD = 0.55;
const DEFAULT_MIN_CLUSTER_SIZE = 4;
/** Yield to the event loop every N pairwise comparisons so other IPC can run. */
const CLUSTER_PAIR_YIELD_INTERVAL = 35_000;
const LEGACY_CENTROID_SAMPLE_LIMIT = 64;
/** SQLite bind parameter safety for `IN (...)` batch reads. */
const STORED_CENTROID_IN_CHUNK = 400;
/** Batch size for legacy (DB) centroid sampling when `face_clusters.centroid_json` is null. */
const LEGACY_CENTROID_CLUSTER_CHUNK = 250;
/** Log comparison progress during very large suggest passes (main process / profile). */
const SUGGEST_PROGRESS_EVERY = 400;

export interface ClusterFaceInfo {
  faceInstanceId: string;
  sourcePath: string;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface FaceClusterResult {
  clusterId: string;
  representativeFaceId: string;
  representativeFace: ClusterFaceInfo | null;
  memberCount: number;
  faceIds: string[];
  /** Normalized centroid JSON; set before persist. */
  centroidJson: string | null;
}

export interface ClusteringOptions {
  similarityThreshold?: number;
  minClusterSize?: number;
  libraryId?: string;
}

export interface ClusterTagSuggestion {
  tagId: string;
  tagLabel: string;
  score: number;
  sampleCount: number;
}

export type FaceClusterSummary = {
  clusterId: string;
  representativeFace: ClusterFaceInfo | null;
  memberCount: number;
};

export interface FaceClusteringProgressPayload {
  phase: "clustering" | "persisting";
  processed: number;
  total: number;
}

interface FaceVector {
  faceId: string;
  mediaItemId: string;
  vector: number[];
  confidence: number;
}

function delayOnEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Lightweight cluster list for the UI: no member IDs, single query with JOIN for representative crop.
 */
export function getFaceClusterSummaries(libraryId = DEFAULT_LIBRARY_ID): FaceClusterSummary[] {
  const t0 = shouldLogUntaggedLoadMain() ? performance.now() : 0;
  const db = getDesktopDatabase();

  const rows = db
    .prepare(
      `SELECT fc.id AS cluster_id,
              fc.member_count,
              fi.id AS face_id,
              mi.source_path,
              fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
              ${FACE_BBOX_REF_WIDTH_SQL} AS image_width,
              ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height
       FROM face_clusters fc
       LEFT JOIN media_face_instances fi
         ON fi.id = fc.representative_face_id AND fi.library_id = fc.library_id
       LEFT JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fc.library_id = ?
         AND fc.merged_into_tag_id IS NULL
       ORDER BY fc.member_count DESC`,
    )
    .all(libraryId) as Array<{
    cluster_id: string;
    member_count: number;
    face_id: string | null;
    source_path: string | null;
    bbox_x: number | null;
    bbox_y: number | null;
    bbox_width: number | null;
    bbox_height: number | null;
    image_width: number | null;
    image_height: number | null;
  }>;

  const summaries = rows.map((r) => ({
    clusterId: r.cluster_id,
    memberCount: r.member_count,
    representativeFace:
      r.face_id &&
      r.source_path !== null &&
      r.bbox_x !== null &&
      r.bbox_y !== null &&
      r.bbox_width !== null &&
      r.bbox_height !== null
        ? {
            faceInstanceId: r.face_id,
            sourcePath: r.source_path,
            bboxX: r.bbox_x,
            bboxY: r.bbox_y,
            bboxWidth: r.bbox_width,
            bboxHeight: r.bbox_height,
            imageWidth: r.image_width,
            imageHeight: r.image_height,
          }
        : null,
  }));

  if (shouldLogUntaggedLoadMain()) {
    logUntaggedLoadMain("getFaceClusterSummaries", "done", {
      ms: Math.round((performance.now() - t0) * 100) / 100,
      clusterCount: summaries.length,
    });
  }

  return summaries;
}

export function getFaceClusterTotalCount(libraryId = DEFAULT_LIBRARY_ID): number {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM face_clusters fc
       WHERE fc.library_id = ?
         AND fc.merged_into_tag_id IS NULL`,
    )
    .get(libraryId) as { c: number };
  return row.c;
}

/**
 * Paged cluster list for the Untagged faces UI (same shape as {@link getFaceClusterSummaries}).
 */
export function getFaceClusterSummariesPage(
  options: { offset: number; limit: number; libraryId?: string },
): FaceClusterSummary[] {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const offset = Math.max(0, options.offset);
  const limit = Math.min(500, Math.max(1, options.limit));
  const t0 = shouldLogUntaggedLoadMain() ? performance.now() : 0;
  const db = getDesktopDatabase();

  const rows = db
    .prepare(
      `SELECT fc.id AS cluster_id,
              fc.member_count,
              fi.id AS face_id,
              mi.source_path,
              fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
              ${FACE_BBOX_REF_WIDTH_SQL} AS image_width,
              ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height
       FROM face_clusters fc
       LEFT JOIN media_face_instances fi
         ON fi.id = fc.representative_face_id AND fi.library_id = fc.library_id
       LEFT JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fc.library_id = ?
         AND fc.merged_into_tag_id IS NULL
       ORDER BY fc.member_count DESC
       LIMIT ? OFFSET ?`,
    )
    .all(libraryId, limit, offset) as Array<{
    cluster_id: string;
    member_count: number;
    face_id: string | null;
    source_path: string | null;
    bbox_x: number | null;
    bbox_y: number | null;
    bbox_width: number | null;
    bbox_height: number | null;
    image_width: number | null;
    image_height: number | null;
  }>;

  const summaries = rows.map((r) => ({
    clusterId: r.cluster_id,
    memberCount: r.member_count,
    representativeFace:
      r.face_id &&
      r.source_path !== null &&
      r.bbox_x !== null &&
      r.bbox_y !== null &&
      r.bbox_width !== null &&
      r.bbox_height !== null
        ? {
            faceInstanceId: r.face_id,
            sourcePath: r.source_path,
            bboxX: r.bbox_x,
            bboxY: r.bbox_y,
            bboxWidth: r.bbox_width,
            bboxHeight: r.bbox_height,
            imageWidth: r.image_width,
            imageHeight: r.image_height,
          }
        : null,
  }));

  if (shouldLogUntaggedLoadMain()) {
    logUntaggedLoadMain("getFaceClusterSummariesPage", "done", {
      ms: Math.round((performance.now() - t0) * 100) / 100,
      clusterCount: summaries.length,
      offset,
      limit,
    });
  }

  return summaries;
}

export function listClusterFaceIdsPage(
  clusterId: string,
  options: { offset?: number; limit?: number; libraryId?: string } = {},
): string[] {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(500, Math.max(1, options.limit ?? 150));

  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT id FROM media_face_instances
       WHERE library_id = ? AND cluster_id = ? AND tag_id IS NULL
       ORDER BY CASE WHEN confidence IS NULL THEN 1 ELSE 0 END,
                confidence DESC,
                id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(libraryId, clusterId, limit, offset) as Array<{ id: string }>;

  return rows.map((row) => row.id);
}

export function suggestPersonTagsForClusters(
  clusterIds: string[],
  options: { threshold?: number; libraryId?: string } = {},
): Record<string, ClusterTagSuggestion | null> {
  const t0 = shouldLogUntaggedLoadMain() ? performance.now() : 0;
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold = options.threshold ?? 0.5;
  const db = getDesktopDatabase();
  const result: Record<string, ClusterTagSuggestion | null> = {};
  for (const id of clusterIds) {
    result[id] = null;
  }
  if (clusterIds.length === 0) {
    return result;
  }

  const storedJsonByCluster = loadStoredCentroidJsonByClusterId(clusterIds, libraryId);
  const needLegacyClusterIds: string[] = [];
  for (const clusterId of clusterIds) {
    const storedJson = storedJsonByCluster.get(clusterId) ?? null;
    if (!parseStoredCentroidOrNull(storedJson)) {
      needLegacyClusterIds.push(clusterId);
    }
  }
  console.log(
    `[emk:untagged-suggest] start clusters=${clusterIds.length} legacyCentroidFallback=${needLegacyClusterIds.length}`,
  );
  const tLegacy = shouldLogUntaggedLoadMain() ? performance.now() : 0;
  const legacyCentroidByCluster = loadLegacySampleCentroidsByClusterIds(
    needLegacyClusterIds,
    libraryId,
  );
  if (shouldLogUntaggedLoadMain()) {
    logUntaggedLoadMain("suggestPersonTagsForClusters", "legacyCentroidsLoaded", {
      ms: Math.round((performance.now() - tLegacy) * 100) / 100,
      legacyClusterCount: needLegacyClusterIds.length,
    });
  }

  const centroidRows = db
    .prepare(
      `SELECT
         pc.tag_id,
         mt.name AS tag_label,
         pc.centroid_json,
         pc.sample_count
       FROM person_centroids pc
       INNER JOIN media_tags mt ON mt.id = pc.tag_id
       WHERE pc.library_id = ?
       ORDER BY mt.name COLLATE NOCASE ASC`,
    )
    .all(libraryId) as Array<{
    tag_id: string;
    tag_label: string;
    centroid_json: string;
    sample_count: number;
  }>;

  const personCentroids = centroidRows
    .map((row) => ({
      tagId: row.tag_id,
      tagLabel: row.tag_label,
      sampleCount: row.sample_count,
      vector: parseVector(row.centroid_json),
    }))
    .filter((row): row is typeof row & { vector: number[] } => row.vector !== null);

  let idx = 0;
  for (const clusterId of clusterIds) {
    idx += 1;
    if (
      clusterIds.length > SUGGEST_PROGRESS_EVERY &&
      idx % SUGGEST_PROGRESS_EVERY === 0
    ) {
      console.log(
        `[emk:untagged-suggest] comparing cluster ${idx}/${clusterIds.length} personTags=${personCentroids.length}`,
      );
    }
    const storedJson = storedJsonByCluster.get(clusterId) ?? null;
    let clusterCentroid = parseStoredCentroidOrNull(storedJson);
    if (!clusterCentroid) {
      clusterCentroid = legacyCentroidByCluster.get(clusterId) ?? null;
    }
    if (!clusterCentroid) {
      continue;
    }
    let best: ClusterTagSuggestion | null = null;
    for (const person of personCentroids) {
      if (person.vector.length !== clusterCentroid.length) {
        continue;
      }
      const score = cosineSimilarity(clusterCentroid, person.vector);
      if (score < threshold) {
        continue;
      }
      if (!best || score > best.score) {
        best = {
          tagId: person.tagId,
          tagLabel: person.tagLabel,
          score,
          sampleCount: person.sampleCount,
        };
      }
    }
    result[clusterId] = best;
  }

  if (shouldLogUntaggedLoadMain()) {
    logUntaggedLoadMain("suggestPersonTagsForClusters", "done", {
      ms: Math.round((performance.now() - t0) * 100) / 100,
      clusterCount: clusterIds.length,
      legacyClusterCount: needLegacyClusterIds.length,
    });
  }

  return result;
}

export async function runClusterUntaggedFacesJob(options: {
  libraryId?: string;
  similarityThreshold?: number;
  minClusterSize?: number;
  shouldCancel: () => boolean;
  onFacesLoaded?: (count: number) => void;
  onProgress?: (payload: FaceClusteringProgressPayload) => void;
}): Promise<{ status: "completed" | "cancelled" | "empty"; clusterCount: number }> {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const minClusterSize = options.minClusterSize ?? DEFAULT_MIN_CLUSTER_SIZE;

  const faces = loadUntaggedEmbeddings(libraryId);
  options.onFacesLoaded?.(faces.length);
  if (faces.length === 0) {
    return { status: "empty", clusterCount: 0 };
  }

  const totalPairs = (faces.length * (faces.length - 1)) / 2;
  const groups = await runAgglomerativeClusteringAsync(faces, threshold, {
    shouldCancel: options.shouldCancel,
    onProgress: (processed) => {
      options.onProgress?.({ phase: "clustering", processed, total: totalPairs });
    },
  });

  if (groups === null || options.shouldCancel()) {
    return { status: "cancelled", clusterCount: 0 };
  }

  const results: FaceClusterResult[] = groups
    .filter((cluster) => cluster.length >= minClusterSize)
    .map((clusterFaces) => {
      const clusterId = randomUUID();
      const representative = pickRepresentative(clusterFaces);
      const centroid = computeNormalizedCentroid(clusterFaces.map((f) => f.vector));
      return {
        clusterId,
        representativeFaceId: representative.faceId,
        representativeFace: getFaceInfoForCrop(representative.faceId),
        memberCount: clusterFaces.length,
        faceIds: clusterFaces.map((f) => f.faceId),
        centroidJson: centroid ? JSON.stringify(centroid) : null,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount);

  if (options.shouldCancel()) {
    return { status: "cancelled", clusterCount: 0 };
  }

  options.onProgress?.({ phase: "persisting", processed: 0, total: results.length });
  persistClusters(results, libraryId);
  options.onProgress?.({
    phase: "persisting",
    processed: results.length,
    total: results.length,
  });

  return { status: "completed", clusterCount: results.length };
}

export function assignClusterToPersonTag(
  clusterId: string,
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): number {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `UPDATE media_face_instances
       SET tag_id = ?, cluster_id = NULL, updated_at = ?
       WHERE library_id = ? AND cluster_id = ?`,
    )
    .run(tagId, now, libraryId, clusterId);

  db.prepare(
    `UPDATE face_clusters
     SET merged_into_tag_id = ?, updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(tagId, now, clusterId, libraryId);

  return result.changes;
}

export function clearClusters(libraryId = DEFAULT_LIBRARY_ID): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE media_face_instances
     SET cluster_id = NULL, updated_at = ?
     WHERE library_id = ? AND cluster_id IS NOT NULL`,
  ).run(now, libraryId);

  db.prepare(
    `DELETE FROM face_clusters WHERE library_id = ? AND merged_into_tag_id IS NULL`,
  ).run(libraryId);
}

export function suggestPersonTagForCluster(
  clusterId: string,
  options: { threshold?: number; libraryId?: string } = {},
): ClusterTagSuggestion | null {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold = options.threshold ?? 0.5;
  const clusterCentroid = resolveClusterCentroidVector(clusterId, libraryId);
  if (!clusterCentroid) {
    return null;
  }

  const db = getDesktopDatabase();
  const centroidRows = db
    .prepare(
      `SELECT
         pc.tag_id,
         mt.name AS tag_label,
         pc.centroid_json,
         pc.sample_count
       FROM person_centroids pc
       INNER JOIN media_tags mt ON mt.id = pc.tag_id
       WHERE pc.library_id = ?
       ORDER BY mt.name COLLATE NOCASE ASC`,
    )
    .all(libraryId) as Array<{
    tag_id: string;
    tag_label: string;
    centroid_json: string;
    sample_count: number;
  }>;

  let best: ClusterTagSuggestion | null = null;
  for (const row of centroidRows) {
    const personCentroid = parseVector(row.centroid_json);
    if (!personCentroid || personCentroid.length !== clusterCentroid.length) {
      continue;
    }
    const score = cosineSimilarity(clusterCentroid, personCentroid);
    if (score < threshold) {
      continue;
    }
    if (!best || score > best.score) {
      best = {
        tagId: row.tag_id,
        tagLabel: row.tag_label,
        score,
        sampleCount: row.sample_count,
      };
    }
  }

  return best;
}

/**
 * For clusters without `centroid_json`, load up to {@link LEGACY_CENTROID_SAMPLE_LIMIT} embeddings
 * per cluster in one round-trip per chunk (avoids thousands of serial SQLite queries).
 */
function loadLegacySampleCentroidsByClusterIds(
  clusterIds: string[],
  libraryId: string,
): Map<string, number[] | null> {
  const out = new Map<string, number[] | null>();
  if (clusterIds.length === 0) {
    return out;
  }
  const db = getDesktopDatabase();
  for (const id of clusterIds) {
    out.set(id, null);
  }

  const sql = `WITH ranked AS (
    SELECT
      cluster_id,
      embedding_json,
      ROW_NUMBER() OVER (
        PARTITION BY cluster_id
        ORDER BY CASE WHEN confidence IS NULL THEN 1 ELSE 0 END, confidence DESC, id ASC
      ) AS rn
    FROM media_face_instances
    WHERE library_id = ?
      AND cluster_id IN (${"PLACEHOLDER"})
      AND tag_id IS NULL
      AND embedding_status = 'ready'
      AND embedding_json IS NOT NULL
  )
  SELECT cluster_id, embedding_json
  FROM ranked
  WHERE rn <= ?`;

  for (let i = 0; i < clusterIds.length; i += LEGACY_CENTROID_CLUSTER_CHUNK) {
    const chunk = clusterIds.slice(i, i + LEGACY_CENTROID_CLUSTER_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const stmt = db.prepare(sql.replace("PLACEHOLDER", placeholders));
    const rows = stmt.all(libraryId, ...chunk, LEGACY_CENTROID_SAMPLE_LIMIT) as Array<{
      cluster_id: string;
      embedding_json: string;
    }>;

    const vectorsByCluster = new Map<string, number[][]>();
    for (const row of rows) {
      const parsed = parseVector(row.embedding_json);
      if (!parsed) continue;
      const list = vectorsByCluster.get(row.cluster_id);
      if (list) {
        list.push(parsed);
      } else {
        vectorsByCluster.set(row.cluster_id, [parsed]);
      }
    }
    for (const clusterId of chunk) {
      const vecs = vectorsByCluster.get(clusterId);
      out.set(clusterId, vecs && vecs.length > 0 ? computeNormalizedCentroid(vecs) : null);
    }
  }

  return out;
}

function loadStoredCentroidJsonByClusterId(
  clusterIds: string[],
  libraryId: string,
): Map<string, string | null> {
  const db = getDesktopDatabase();
  const map = new Map<string, string | null>();
  for (const id of clusterIds) {
    map.set(id, null);
  }
  for (let i = 0; i < clusterIds.length; i += STORED_CENTROID_IN_CHUNK) {
    const chunk = clusterIds.slice(i, i + STORED_CENTROID_IN_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT id, centroid_json FROM face_clusters
         WHERE library_id = ?
           AND merged_into_tag_id IS NULL
           AND id IN (${placeholders})`,
      )
      .all(libraryId, ...chunk) as Array<{ id: string; centroid_json: string | null }>;
    for (const row of rows) {
      map.set(row.id, row.centroid_json);
    }
  }
  return map;
}

function parseStoredCentroidOrNull(centroidJson: string | null): number[] | null {
  if (!centroidJson) return null;
  return parseVector(centroidJson);
}

function legacySampleCentroid(clusterId: string, libraryId: string): number[] | null {
  const db = getDesktopDatabase();
  const sampleRows = db
    .prepare(
      `SELECT embedding_json
       FROM media_face_instances
       WHERE library_id = ?
         AND cluster_id = ?
         AND tag_id IS NULL
         AND embedding_status = 'ready'
         AND embedding_json IS NOT NULL
       ORDER BY CASE WHEN confidence IS NULL THEN 1 ELSE 0 END, confidence DESC
       LIMIT ?`,
    )
    .all(libraryId, clusterId, LEGACY_CENTROID_SAMPLE_LIMIT) as Array<{ embedding_json: string }>;

  const vectors = sampleRows
    .map((row) => parseVector(row.embedding_json))
    .filter((value): value is number[] => value !== null);

  return computeNormalizedCentroid(vectors);
}

function resolveClusterCentroidVector(
  clusterId: string,
  libraryId: string,
): number[] | null {
  const db = getDesktopDatabase();

  const stored = db
    .prepare(
      `SELECT centroid_json FROM face_clusters
       WHERE id = ? AND library_id = ? AND merged_into_tag_id IS NULL`,
    )
    .get(clusterId, libraryId) as { centroid_json: string | null } | undefined;

  const fromStored = parseStoredCentroidOrNull(stored?.centroid_json ?? null);
  if (fromStored) {
    return fromStored;
  }

  return legacySampleCentroid(clusterId, libraryId);
}

function getFaceInfoForCrop(faceId: string): ClusterFaceInfo | null {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT fi.id, mi.source_path, fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
              ${FACE_BBOX_REF_WIDTH_SQL} AS image_width, ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.id = ?`,
    )
    .get(faceId) as
    | {
        id: string;
        source_path: string;
        bbox_x: number;
        bbox_y: number;
        bbox_width: number;
        bbox_height: number;
        image_width: number | null;
        image_height: number | null;
      }
    | undefined;

  if (!row) return null;
  return {
    faceInstanceId: row.id,
    sourcePath: row.source_path,
    bboxX: row.bbox_x,
    bboxY: row.bbox_y,
    bboxWidth: row.bbox_width,
    bboxHeight: row.bbox_height,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
  };
}

export function loadUntaggedEmbeddings(libraryId: string): FaceVector[] {
  const db = getDesktopDatabase();

  const rows = db
    .prepare(
      `SELECT id, media_item_id, embedding_json, confidence
       FROM media_face_instances
       WHERE library_id = ?
         AND tag_id IS NULL
         AND embedding_json IS NOT NULL
         AND embedding_status = 'ready'`,
    )
    .all(libraryId) as Array<{
    id: string;
    media_item_id: string;
    embedding_json: string;
    confidence: number | null;
  }>;

  const faces: FaceVector[] = [];
  for (const row of rows) {
    const vector = parseVector(row.embedding_json);
    if (vector) {
      faces.push({
        faceId: row.id,
        mediaItemId: row.media_item_id,
        vector,
        confidence: row.confidence ?? 0,
      });
    }
  }
  return faces;
}

async function runAgglomerativeClusteringAsync(
  faces: FaceVector[],
  threshold: number,
  opts: {
    shouldCancel: () => boolean;
    onProgress?: (processed: number) => void;
  },
): Promise<FaceVector[][] | null> {
  const n = faces.length;
  const totalPairs = (n * (n - 1)) / 2;
  const parent = new Int32Array(n);
  const rank = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    parent[i] = i;
  }

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(x: number, y: number): void {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX === rootY) {
      return;
    }
    if (rank[rootX] < rank[rootY]) {
      parent[rootX] = rootY;
    } else if (rank[rootX] > rank[rootY]) {
      parent[rootY] = rootX;
    } else {
      parent[rootY] = rootX;
      rank[rootX]++;
    }
  }

  let processedPairs = 0;
  for (let i = 0; i < n; i++) {
    if (opts.shouldCancel()) {
      return null;
    }
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(faces[i].vector, faces[j].vector);
      if (sim >= threshold) {
        union(i, j);
      }
      processedPairs++;
      if (processedPairs % CLUSTER_PAIR_YIELD_INTERVAL === 0) {
        if (opts.shouldCancel()) {
          return null;
        }
        opts.onProgress?.(processedPairs);
        await delayOnEventLoop();
      }
    }
  }

  opts.onProgress?.(totalPairs);

  const groups = new Map<number, FaceVector[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) {
      group.push(faces[i]);
    } else {
      groups.set(root, [faces[i]]);
    }
  }

  return Array.from(groups.values());
}

function pickRepresentative(faces: FaceVector[]): FaceVector {
  return faces.reduce((best, face) =>
    face.confidence > best.confidence ? face : best,
  );
}

function persistClusters(clusters: FaceClusterResult[], libraryId: string): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE media_face_instances
       SET cluster_id = NULL, updated_at = ?
       WHERE library_id = ? AND cluster_id IS NOT NULL
         AND tag_id IS NULL`,
    ).run(now, libraryId);

    db.prepare(
      `DELETE FROM face_clusters
       WHERE library_id = ? AND merged_into_tag_id IS NULL`,
    ).run(libraryId);

    const insertCluster = db.prepare(
      `INSERT INTO face_clusters (
         id, library_id, representative_face_id, member_count,
         centroid_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const updateFace = db.prepare(
      `UPDATE media_face_instances
       SET cluster_id = ?, updated_at = ?
       WHERE id = ? AND library_id = ?`,
    );

    for (const cluster of clusters) {
      insertCluster.run(
        cluster.clusterId,
        libraryId,
        cluster.representativeFaceId,
        cluster.memberCount,
        cluster.centroidJson,
        now,
        now,
      );

      for (const faceId of cluster.faceIds) {
        updateFace.run(cluster.clusterId, now, faceId, libraryId);
      }
    }
  });

  tx();
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

function computeNormalizedCentroid(vectors: number[][]): number[] | null {
  if (vectors.length === 0) {
    return null;
  }

  const dim = vectors[0].length;
  const sum = new Float64Array(dim);
  for (const vector of vectors) {
    if (vector.length !== dim) {
      continue;
    }
    for (let i = 0; i < dim; i += 1) {
      sum[i] += vector[i];
    }
  }

  const centroid = Array.from(sum).map((value) => value / vectors.length);
  let norm = 0;
  for (const value of centroid) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) {
    return null;
  }
  for (let i = 0; i < centroid.length; i += 1) {
    centroid[i] /= norm;
  }
  return centroid;
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
