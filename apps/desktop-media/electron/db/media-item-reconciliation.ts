import path from "node:path";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { markSourceDeleted } from "./media-item-sources";
import { appendSyncOperation } from "./sync-log";

export interface ReconcileFolderResult {
  softDeleted: number;
  resurrected: number;
}

/**
 * Reconcile media_items for a single folder against the set of file paths
 * currently observed on disk.
 *
 * - Files in DB but missing from disk → set `deleted_at` (soft-delete).
 * - Files previously soft-deleted but now present again → clear `deleted_at`.
 */
export function reconcileFolder(
  folderPath: string,
  observedPaths: Set<string>,
  libraryId = DEFAULT_LIBRARY_ID,
): ReconcileFolderResult {
  const db = getDesktopDatabase();
  const sep = path.sep;
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;

  const candidates = db
    .prepare(
      `SELECT id, source_path, deleted_at
       FROM media_items
       WHERE library_id = ?
         AND (source_path = ? OR instr(source_path, ?) = 1)`,
    )
    .all(libraryId, folderPath, folderPrefix) as Array<{
    id: string;
    source_path: string;
    deleted_at: string | null;
  }>;

  if (candidates.length === 0) {
    return { softDeleted: 0, resurrected: 0 };
  }

  const directChildren = candidates.filter(
    (row) => path.dirname(row.source_path) === folderPath,
  );

  const now = new Date().toISOString();
  const markDeleted = db.prepare(
    `UPDATE media_items SET deleted_at = ?, updated_at = ? WHERE id = ?`,
  );
  const clearDeleted = db.prepare(
    `UPDATE media_items SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
  );

  let softDeleted = 0;
  let resurrected = 0;

  const tx = db.transaction(() => {
    for (const row of directChildren) {
      const onDisk = observedPaths.has(row.source_path);
      if (!onDisk && row.deleted_at === null) {
        markDeleted.run(now, now, row.id);
        const sourceResult = markSourceDeleted({ sourcePath: row.source_path, libraryId });
        if (sourceResult && !sourceResult.hasOtherActiveSources) {
          appendSyncOperation({
            mediaId: row.id,
            operationType: "media.delete",
            payload: { reason: "file_missing", lastSourcePath: row.source_path },
            libraryId,
          });
        }
        softDeleted += 1;
      } else if (onDisk && row.deleted_at !== null) {
        clearDeleted.run(now, row.id);
        resurrected += 1;
      }
    }
  });

  tx();
  return { softDeleted, resurrected };
}

const PURGE_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export interface PurgeResult {
  purgedMediaItems: number;
  purgedFaceInstances: number;
  purgedEmbeddings: number;
  purgedAlbumItems: number;
  purgedItemTags: number;
  purgedFsObjects: number;
  purgedSources: number;
}

/**
 * Hard-delete media_items that have been soft-deleted for longer than the
 * grace period, along with all their child rows in dependent tables.
 */
export function purgeDeletedMediaItems(
  libraryId = DEFAULT_LIBRARY_ID,
  gracePeriodMs = PURGE_GRACE_PERIOD_MS,
): PurgeResult {
  const db = getDesktopDatabase();
  const cutoff = new Date(Date.now() - gracePeriodMs).toISOString();

  const expired = db
    .prepare(
      `SELECT id, source_path
       FROM media_items
       WHERE library_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?`,
    )
    .all(libraryId, cutoff) as Array<{ id: string; source_path: string }>;

  if (expired.length === 0) {
    return {
      purgedMediaItems: 0,
      purgedFaceInstances: 0,
      purgedEmbeddings: 0,
      purgedAlbumItems: 0,
      purgedItemTags: 0,
      purgedFsObjects: 0,
      purgedSources: 0,
    };
  }

  const ids = expired.map((row) => row.id);
  const sourcePaths = expired.map((row) => row.source_path);

  const result: PurgeResult = {
    purgedMediaItems: 0,
    purgedFaceInstances: 0,
    purgedEmbeddings: 0,
    purgedAlbumItems: 0,
    purgedItemTags: 0,
    purgedFsObjects: 0,
    purgedSources: 0,
  };

  const BATCH_SIZE = 400;

  const tx = db.transaction(() => {
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const batchIds = ids.slice(offset, offset + BATCH_SIZE);
      const batchPaths = sourcePaths.slice(offset, offset + BATCH_SIZE);
      const idPlaceholders = batchIds.map(() => "?").join(", ");
      const pathPlaceholders = batchPaths.map(() => "?").join(", ");

      result.purgedFaceInstances += db
        .prepare(
          `DELETE FROM media_face_instances
           WHERE library_id = ? AND media_item_id IN (${idPlaceholders})`,
        )
        .run(libraryId, ...batchIds).changes;

      result.purgedEmbeddings += db
        .prepare(
          `DELETE FROM media_embeddings
           WHERE library_id = ? AND media_item_id IN (${idPlaceholders})`,
        )
        .run(libraryId, ...batchIds).changes;

      result.purgedAlbumItems += db
        .prepare(
          `DELETE FROM media_album_items
           WHERE library_id = ? AND media_item_id IN (${idPlaceholders})`,
        )
        .run(libraryId, ...batchIds).changes;

      result.purgedItemTags += db
        .prepare(
          `DELETE FROM media_item_tags
           WHERE library_id = ? AND media_item_id IN (${idPlaceholders})`,
        )
        .run(libraryId, ...batchIds).changes;

      result.purgedSources += db
        .prepare(
          `DELETE FROM media_item_sources
           WHERE library_id = ? AND media_item_id IN (${idPlaceholders})`,
        )
        .run(libraryId, ...batchIds).changes;

      result.purgedFsObjects += db
        .prepare(
          `DELETE FROM fs_objects
           WHERE library_id = ? AND current_path IN (${pathPlaceholders})`,
        )
        .run(libraryId, ...batchPaths).changes;

      result.purgedMediaItems += db
        .prepare(
          `DELETE FROM media_items
           WHERE library_id = ? AND id IN (${idPlaceholders})`,
        )
        .run(libraryId, ...batchIds).changes;
    }
  });

  tx();
  return result;
}
