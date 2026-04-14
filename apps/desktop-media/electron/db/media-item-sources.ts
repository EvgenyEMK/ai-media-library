import { randomUUID } from "node:crypto";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { appendSyncOperation } from "./sync-log";

export interface MediaItemSource {
  id: string;
  mediaItemId: string;
  libraryId: string;
  sourcePath: string;
  clientId: string;
  fsObjectId: string | null;
  isPrimary: boolean;
  status: "active" | "deleted" | "moved";
  deletedAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function upsertSource(params: {
  mediaItemId: string;
  sourcePath: string;
  fsObjectId?: string | null;
  isPrimary?: boolean;
  libraryId?: string;
  clientId?: string;
}): string {
  const db = getDesktopDatabase();
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const clientId = params.clientId ?? "local-default";
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO media_item_sources (
      id, media_item_id, library_id, source_path, client_id,
      fs_object_id, is_primary, status, last_verified_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    ON CONFLICT(library_id, source_path, client_id) DO UPDATE SET
      media_item_id = excluded.media_item_id,
      fs_object_id = COALESCE(excluded.fs_object_id, media_item_sources.fs_object_id),
      is_primary = excluded.is_primary,
      status = 'active',
      deleted_at = NULL,
      last_verified_at = excluded.last_verified_at,
      updated_at = excluded.updated_at`,
  ).run(
    id,
    params.mediaItemId,
    libraryId,
    params.sourcePath,
    clientId,
    params.fsObjectId ?? null,
    params.isPrimary ? 1 : 0,
    now,
    now,
    now,
  );

  appendSyncOperation({
    mediaId: params.mediaItemId,
    operationType: "media.source.add",
    payload: { sourcePath: params.sourcePath, clientId },
    libraryId,
  });

  return id;
}

export function updateSourcePath(params: {
  oldPath: string;
  newPath: string;
  libraryId?: string;
  clientId?: string;
}): { mediaItemId: string; wasPrimary: boolean } | null {
  const db = getDesktopDatabase();
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const clientId = params.clientId ?? "local-default";
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      `SELECT id, media_item_id, is_primary
       FROM media_item_sources
       WHERE library_id = ? AND source_path = ? AND client_id = ?
       LIMIT 1`,
    )
    .get(libraryId, params.oldPath, clientId) as
    | { id: string; media_item_id: string; is_primary: number }
    | undefined;

  if (!existing) {
    return null;
  }

  db.prepare(
    `UPDATE media_item_sources
     SET source_path = ?, status = 'active', deleted_at = NULL, updated_at = ?
     WHERE id = ?`,
  ).run(params.newPath, now, existing.id);

  return {
    mediaItemId: existing.media_item_id,
    wasPrimary: existing.is_primary === 1,
  };
}

export function markSourceDeleted(params: {
  sourcePath: string;
  libraryId?: string;
  clientId?: string;
}): { mediaItemId: string; hasOtherActiveSources: boolean } | null {
  const db = getDesktopDatabase();
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const clientId = params.clientId ?? "local-default";
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      `SELECT id, media_item_id
       FROM media_item_sources
       WHERE library_id = ? AND source_path = ? AND client_id = ? AND status = 'active'
       LIMIT 1`,
    )
    .get(libraryId, params.sourcePath, clientId) as
    | { id: string; media_item_id: string }
    | undefined;

  if (!existing) {
    return null;
  }

  db.prepare(
    `UPDATE media_item_sources
     SET status = 'deleted', deleted_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(now, now, existing.id);

  appendSyncOperation({
    mediaId: existing.media_item_id,
    operationType: "media.source.remove",
    payload: { sourcePath: params.sourcePath, clientId },
    libraryId,
  });

  const otherActive = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM media_item_sources
       WHERE media_item_id = ? AND status = 'active' AND id != ?`,
    )
    .get(existing.media_item_id, existing.id) as { cnt: number };

  return {
    mediaItemId: existing.media_item_id,
    hasOtherActiveSources: otherActive.cnt > 0,
  };
}

export function findSourceByPath(
  sourcePath: string,
  libraryId = DEFAULT_LIBRARY_ID,
  clientId = "local-default",
): MediaItemSource | null {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT id, media_item_id, library_id, source_path, client_id,
              fs_object_id, is_primary, status, deleted_at,
              last_verified_at, created_at, updated_at
       FROM media_item_sources
       WHERE library_id = ? AND source_path = ? AND client_id = ?
       LIMIT 1`,
    )
    .get(libraryId, sourcePath, clientId) as
    | {
        id: string;
        media_item_id: string;
        library_id: string;
        source_path: string;
        client_id: string;
        fs_object_id: string | null;
        is_primary: number;
        status: string;
        deleted_at: string | null;
        last_verified_at: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    mediaItemId: row.media_item_id,
    libraryId: row.library_id,
    sourcePath: row.source_path,
    clientId: row.client_id,
    fsObjectId: row.fs_object_id,
    isPrimary: row.is_primary === 1,
    status: row.status as MediaItemSource["status"],
    deletedAt: row.deleted_at,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getActiveSourceCountForMediaItem(
  mediaItemId: string,
): number {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM media_item_sources WHERE media_item_id = ? AND status = 'active'`,
    )
    .get(mediaItemId) as { cnt: number };
  return row.cnt;
}
