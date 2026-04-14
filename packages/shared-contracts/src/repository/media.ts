/**
 * MediaRepository — platform-agnostic data access contract for media items.
 *
 * Desktop implementation: SQLite via better-sqlite3 (electron/db/).
 * Web implementation: Supabase/Postgres (lib/db/media/).
 *
 * Each platform extends this interface with backend-specific operations.
 * The shared interface covers the operations common to all pipeline stages
 * (import, AI analysis, face detection, semantic search).
 */

import type { AiAnnotation, MediaId, MediaLibraryId } from "../domain/media";

export interface MediaItemRecord {
  id: MediaId;
  libraryId: MediaLibraryId;
  title?: string;
  sourcePath: string;
  mimeType?: string;
  width?: number;
  height?: number;
  capturedAt?: string;
  importedAt?: string;
  aiMetadata?: Record<string, unknown>;
  photoAnalysisProcessedAt?: string;
  faceDetectionProcessedAt?: string;
}

export interface MediaItemQuery {
  libraryId?: MediaLibraryId;
  folderPath?: string;
  limit?: number;
  offset?: number;
}

export interface MediaRepository {
  getById(
    mediaItemId: MediaId,
    libraryId?: MediaLibraryId,
  ): Promise<MediaItemRecord | null>;

  listByQuery(query: MediaItemQuery): Promise<MediaItemRecord[]>;

  updateAiAnnotations(
    mediaItemId: MediaId,
    annotations: AiAnnotation[],
    libraryId?: MediaLibraryId,
  ): Promise<void>;

  markPhotoAnalysisComplete(
    mediaItemId: MediaId,
    libraryId?: MediaLibraryId,
  ): Promise<void>;

  markFaceDetectionComplete(
    mediaItemId: MediaId,
    libraryId?: MediaLibraryId,
  ): Promise<void>;
}
