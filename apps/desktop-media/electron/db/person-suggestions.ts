/**
 * Maintains the `media_item_person_suggestions` table that tracks which
 * media items likely contain a given person even though the face is not yet
 * confirmed (tagged). Semantic search uses this table to optionally expand
 * person-tag filtering to unconfirmed matches.
 */

import { DEFAULT_FACE_DETECTION_SETTINGS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { findMatchesForPerson } from "./face-embeddings";

/**
 * Maximum number of untagged face embeddings to evaluate per person centroid
 * during a full refresh. Keeps wall-clock time bounded on large libraries.
 */
const MAX_FACES_PER_REFRESH = 50_000;

interface PersonCentroidRow {
  tag_id: string;
  centroid_json: string;
}

/**
 * Refresh suggestions for a single person tag.
 *
 * Called after centroid changes (face tag assign/clear, cluster assign).
 * Scans all untagged faces with ready embeddings and records the best
 * similarity per media item.
 */
export function refreshSuggestionsForTag(
  tagId: string,
  options: { threshold?: number; libraryId?: string } = {},
): number {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const threshold =
    options.threshold ?? DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold;
  const db = getDesktopDatabase();

  const centroidRow = db
    .prepare(
      `SELECT centroid_json FROM person_centroids WHERE tag_id = ? AND library_id = ?`,
    )
    .get(tagId, libraryId) as { centroid_json: string } | undefined;

  if (!centroidRow) {
    db.prepare(
      `DELETE FROM media_item_person_suggestions WHERE library_id = ? AND tag_id = ?`,
    ).run(libraryId, tagId);
    return 0;
  }

  const centroid = parseVector(centroidRow.centroid_json);
  if (!centroid) {
    return 0;
  }

  const faces = db
    .prepare(
      `SELECT fi.id, fi.media_item_id, fi.embedding_json
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.library_id = ?
         AND fi.tag_id IS NULL
         AND fi.embedding_json IS NOT NULL
         AND (fi.embedding_status = 'ready' OR fi.embedding_status IS NULL)
         AND mi.deleted_at IS NULL
       LIMIT ?`,
    )
    .all(libraryId, MAX_FACES_PER_REFRESH) as Array<{
    id: string;
    media_item_id: string;
    embedding_json: string;
  }>;

  const bestByMedia = new Map<string, { similarity: number; faceId: string }>();

  for (const face of faces) {
    const vec = parseVector(face.embedding_json);
    if (!vec || vec.length !== centroid.length) continue;

    const sim = cosineSimilarity(centroid, vec);
    if (sim < threshold) continue;

    const current = bestByMedia.get(face.media_item_id);
    if (!current || sim > current.similarity) {
      bestByMedia.set(face.media_item_id, { similarity: sim, faceId: face.id });
    }
  }

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM media_item_person_suggestions WHERE library_id = ? AND tag_id = ?`,
    ).run(libraryId, tagId);

    if (bestByMedia.size === 0) return;

    const insert = db.prepare(
      `INSERT INTO media_item_person_suggestions
         (library_id, media_item_id, tag_id, best_similarity, exemplar_face_instance_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const [mediaItemId, entry] of bestByMedia) {
      insert.run(libraryId, mediaItemId, tagId, entry.similarity, entry.faceId, now);
    }
  });

  tx();

  /** Same definition as Tagged faces / findPersonMatches (full library, not the 50k suggestion scan). */
  const librarySimilarUntaggedFaceCount = findMatchesForPerson(tagId, {
    threshold,
    limit: 0,
    libraryId,
  }).length;

  db.prepare(
    `UPDATE person_centroids
     SET similar_untagged_face_count = ?,
         similar_counts_updated_at = ?
     WHERE tag_id = ? AND library_id = ?`,
  ).run(librarySimilarUntaggedFaceCount, now, tagId, libraryId);

  return bestByMedia.size;
}

/**
 * Refresh suggestions for ALL person tags. Used as a full rebuild, e.g.
 * after bulk embedding generation or a manual "Refresh" action.
 */
export function refreshAllSuggestions(
  options: { threshold?: number; libraryId?: string } = {},
): number {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const db = getDesktopDatabase();

  const tags = db
    .prepare(`SELECT tag_id FROM person_centroids WHERE library_id = ?`)
    .all(libraryId) as Array<{ tag_id: string }>;

  let total = 0;
  for (const tag of tags) {
    total += refreshSuggestionsForTag(tag.tag_id, { ...options, libraryId });
  }
  return total;
}

/**
 * Ensure suggestions exist for the given tag IDs. If a tag has zero
 * suggestion rows, refresh it. Returns the number of tags that were
 * refreshed (i.e. were empty and got populated).
 *
 * Called lazily from the semantic search handler when the unconfirmed
 * faces toggle is on, so existing data is never stale after the initial
 * population.
 */
export function ensureSuggestionsExist(
  tagIds: string[],
  options: { threshold?: number; libraryId?: string } = {},
): number {
  const libraryId = options.libraryId ?? DEFAULT_LIBRARY_ID;
  const db = getDesktopDatabase();
  let refreshed = 0;

  for (const tagId of tagIds) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM media_item_person_suggestions
         WHERE library_id = ? AND tag_id = ?`,
      )
      .get(libraryId, tagId) as { cnt: number };

    if (row.cnt === 0) {
      const count = refreshSuggestionsForTag(tagId, { ...options, libraryId });
      if (count > 0) refreshed += 1;
    }
  }

  return refreshed;
}

/**
 * Remove suggestions for a specific media item (e.g. when its face gets
 * confirmed/tagged — the suggestion is no longer needed for that tag).
 */
export function clearSuggestionsForMediaItemTag(
  mediaItemId: string,
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  db.prepare(
    `DELETE FROM media_item_person_suggestions
     WHERE library_id = ? AND media_item_id = ? AND tag_id = ?`,
  ).run(libraryId, mediaItemId, tagId);
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

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
