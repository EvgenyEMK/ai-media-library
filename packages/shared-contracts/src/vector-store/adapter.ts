/**
 * Vector store adapter — abstracts nearest-neighbor search over embeddings.
 *
 * Desktop implementation: SQLite with json-based cosine similarity or sqlite-vec.
 * Web implementation: pgvector in Supabase/Postgres, or a cloud vector DB.
 */

export type EmbeddingType = "face" | "image" | "text";
export type EmbeddingSource = "direct_image" | "direct_vision" | "ai_metadata" | "generated_caption" | "caption_fallback";

export interface VectorStoreUpsertParams {
  mediaItemId: string;
  embeddingType: EmbeddingType;
  embeddingSource?: EmbeddingSource;
  modelVersion: string;
  vector: number[];
  indexedAt?: string;
  libraryId?: string;
}

export interface VectorStoreSearchParams {
  query: number[];
  embeddingType: EmbeddingType;
  modelVersion: string;
  libraryId?: string;
  limit?: number;
}

export interface VectorStoreSearchResult {
  mediaItemId: string;
  score: number;
}

export interface VectorStoreMarkParams {
  mediaItemId: string;
  embeddingType: EmbeddingType;
  modelVersion: string;
  libraryId?: string;
}

export interface VectorStoreFailParams extends VectorStoreMarkParams {
  error: string;
}

export interface VectorStoreAdapter {
  upsertEmbedding(params: VectorStoreUpsertParams): void;
  searchNearest(params: VectorStoreSearchParams): VectorStoreSearchResult[];
  markEmbeddingIndexing(params: VectorStoreMarkParams): void;
  markEmbeddingFailed(params: VectorStoreFailParams): void;
}
