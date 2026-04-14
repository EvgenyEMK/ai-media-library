import { randomUUID } from "node:crypto";
import type {
  VectorStoreAdapter,
  VectorStoreFailParams,
  VectorStoreMarkParams,
  VectorStoreSearchParams,
  VectorStoreSearchResult,
  VectorStoreUpsertParams,
} from "@emk/shared-contracts";
import { getDesktopDatabase, getVectorBackendStatus } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

export type { VectorStoreAdapter } from "@emk/shared-contracts";

export class SQLiteVectorStoreAdapter implements VectorStoreAdapter {
  upsertEmbedding(params: VectorStoreUpsertParams): void {
    const db = getDesktopDatabase();
    const now = new Date().toISOString();
    const indexedAt = params.indexedAt ?? now;
    db.prepare(
      `INSERT INTO media_embeddings (
        id,
        library_id,
        media_item_id,
        embedding_type,
        embedding_source,
        embedding_status,
        model_version,
        dimension,
        vector_json,
        indexed_at,
        last_error,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(library_id, media_item_id, embedding_type, model_version) DO UPDATE SET
        embedding_source = excluded.embedding_source,
        embedding_status = 'ready',
        dimension = excluded.dimension,
        vector_json = excluded.vector_json,
        indexed_at = excluded.indexed_at,
        last_error = NULL,
        updated_at = excluded.updated_at`,
    ).run(
      randomUUID(),
      params.libraryId ?? DEFAULT_LIBRARY_ID,
      params.mediaItemId,
      params.embeddingType,
      params.embeddingSource ?? "direct_image",
      params.modelVersion,
      params.vector.length,
      JSON.stringify(params.vector),
      indexedAt,
      now,
      now,
    );
  }

  searchNearest(params: VectorStoreSearchParams): VectorStoreSearchResult[] {
    const db = getDesktopDatabase();
    const limit = Math.max(1, params.limit ?? 25);
    const backend = getVectorBackendStatus();

    if (backend.activeMode === "sqlite-vec") {
      try {
        const queryVectorJson = JSON.stringify(params.query);
        const rows = db
          .prepare(
            `SELECT media_item_id, vec_distance_cosine(vector_json, ?) AS distance
             FROM media_embeddings
             WHERE library_id = ? AND embedding_type = ? AND model_version = ? AND embedding_status = 'ready'
             ORDER BY distance ASC
             LIMIT ?`,
          )
          .all(
            queryVectorJson,
            params.libraryId ?? DEFAULT_LIBRARY_ID,
            params.embeddingType,
            params.modelVersion,
            limit,
          ) as Array<{ media_item_id: string; distance: number | null }>;

        const scored = rows
          .filter((row) => typeof row.distance === "number" && Number.isFinite(row.distance))
          .map((row) => ({
            mediaItemId: row.media_item_id,
            // similarity proxy from distance; clamp for safety.
            score: Math.max(-1, Math.min(1, 1 - Number(row.distance))),
          }));
        if (scored.length > 0) {
          return scored;
        }
      } catch {
        // Fall back to classic JS cosine search when sqlite-vec function isn't available.
      }
    }

    const rows = db
      .prepare(
        `SELECT media_item_id, vector_json
         FROM media_embeddings
         WHERE library_id = ? AND embedding_type = ? AND model_version = ? AND embedding_status = 'ready'`,
      )
      .all(
        params.libraryId ?? DEFAULT_LIBRARY_ID,
        params.embeddingType,
        params.modelVersion,
      ) as Array<{ media_item_id: string; vector_json: string }>;

    const scored = rows
      .map((row) => {
        const vector = parseVector(row.vector_json);
        if (!vector || vector.length !== params.query.length) {
          return null;
        }
        return {
          mediaItemId: row.media_item_id,
          score: cosineSimilarity(params.query, vector),
        };
      })
      .filter((item): item is { mediaItemId: string; score: number } => Boolean(item))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  markEmbeddingIndexing(params: VectorStoreMarkParams): void {
    const db = getDesktopDatabase();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO media_embeddings (
        id,
        library_id,
        media_item_id,
        embedding_type,
        embedding_source,
        embedding_status,
        model_version,
        dimension,
        vector_json,
        indexed_at,
        last_error,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'direct_image', 'indexing', ?, 0, '[]', NULL, NULL, ?, ?)
      ON CONFLICT(library_id, media_item_id, embedding_type, model_version) DO UPDATE SET
        embedding_status = 'indexing',
        last_error = NULL,
        updated_at = excluded.updated_at`,
    ).run(
      randomUUID(),
      params.libraryId ?? DEFAULT_LIBRARY_ID,
      params.mediaItemId,
      params.embeddingType,
      params.modelVersion,
      now,
      now,
    );
  }

  markEmbeddingFailed(params: VectorStoreFailParams): void {
    const db = getDesktopDatabase();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO media_embeddings (
        id,
        library_id,
        media_item_id,
        embedding_type,
        embedding_source,
        embedding_status,
        model_version,
        dimension,
        vector_json,
        indexed_at,
        last_error,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'direct_image', 'failed', ?, 0, '[]', NULL, ?, ?, ?)
      ON CONFLICT(library_id, media_item_id, embedding_type, model_version) DO UPDATE SET
        embedding_status = 'failed',
        last_error = excluded.last_error,
        updated_at = excluded.updated_at`,
    ).run(
      randomUUID(),
      params.libraryId ?? DEFAULT_LIBRARY_ID,
      params.mediaItemId,
      params.embeddingType,
      params.modelVersion,
      params.error.slice(0, 500),
      now,
      now,
    );
  }
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
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
