import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { updateSourcePath } from "./media-item-sources";

/** SQLite default SQLITE_MAX_VARIABLE_NUMBER is often 999; keep IN lists under that (incl. library_id). */
const OBSERVED_PATHS_QUERY_CHUNK = 900;

interface ObservedFile {
  absolutePath: string;
  stats: Stats;
  volumeId: string;
  osFileId: string;
  quickFingerprint: string;
}

type DesktopSqliteDatabase = ReturnType<typeof getDesktopDatabase>;

function getFsObjectPersistence(db: DesktopSqliteDatabase) {
  const findActiveByOsId = db.prepare(
    `SELECT id, current_path
     FROM fs_objects
     WHERE library_id = ? AND volume_id = ? AND os_file_id = ? AND deleted_at IS NULL
     LIMIT 1`,
  );
  const findActiveByPath = db.prepare(
    `SELECT id FROM fs_objects WHERE library_id = ? AND current_path = ? AND deleted_at IS NULL LIMIT 1`,
  );
  const findDeletedByQuickFingerprint = db.prepare(
    `SELECT id, strong_hash
     FROM fs_objects
     WHERE library_id = ?
       AND quick_fingerprint = ?
       AND deleted_at IS NOT NULL
       AND deleted_at >= ?
     ORDER BY deleted_at DESC`,
  );
  const insertOrUpdateByPath = db.prepare(
    `INSERT INTO fs_objects (
      id,
      library_id,
      current_path,
      volume_id,
      os_file_id,
      file_size,
      mtime_ms,
      ctime_ms,
      quick_fingerprint,
      strong_hash,
      last_seen_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, current_path) DO UPDATE SET
      volume_id = excluded.volume_id,
      os_file_id = excluded.os_file_id,
      file_size = excluded.file_size,
      mtime_ms = excluded.mtime_ms,
      ctime_ms = excluded.ctime_ms,
      quick_fingerprint = excluded.quick_fingerprint,
      deleted_at = NULL,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at`,
  );
  const updateExistingById = db.prepare(
    `UPDATE fs_objects
     SET current_path = ?,
         volume_id = ?,
         os_file_id = ?,
         file_size = ?,
         mtime_ms = ?,
         ctime_ms = ?,
         quick_fingerprint = ?,
         strong_hash = COALESCE(?, strong_hash),
         deleted_at = NULL,
         last_seen_at = ?,
         updated_at = ?
     WHERE id = ?`,
  );
  return {
    findActiveByOsId,
    findActiveByPath,
    findDeletedByQuickFingerprint,
    insertOrUpdateByPath,
    updateExistingById,
  };
}

async function persistObservedFileIntoFsObjects(params: {
  libraryId: string;
  item: ObservedFile;
  persistence: ReturnType<typeof getFsObjectPersistence>;
  recentTombstoneThreshold: string;
}): Promise<string | null> {
  const { libraryId, item, persistence: p, recentTombstoneThreshold } = params;
  const now = new Date().toISOString();
  const strongHash = await maybeComputeStrongHash(item.absolutePath, item.stats.size);

  const byOsId = p.findActiveByOsId.get(libraryId, item.volumeId, item.osFileId) as
    | { id: string; current_path: string }
    | undefined;
  if (byOsId) {
    const oldPath = byOsId.current_path;
    p.updateExistingById.run(
      item.absolutePath,
      item.volumeId,
      item.osFileId,
      item.stats.size,
      Math.trunc(item.stats.mtimeMs),
      Math.trunc(item.stats.ctimeMs),
      item.quickFingerprint,
      strongHash,
      now,
      now,
      byOsId.id,
    );

    if (oldPath !== item.absolutePath) {
      propagatePathChange(oldPath, item.absolutePath, libraryId);
    }
    return strongHash;
  }

  const byPath = p.findActiveByPath.get(libraryId, item.absolutePath) as { id: string } | undefined;
  if (byPath) {
    p.updateExistingById.run(
      item.absolutePath,
      item.volumeId,
      item.osFileId,
      item.stats.size,
      Math.trunc(item.stats.mtimeMs),
      Math.trunc(item.stats.ctimeMs),
      item.quickFingerprint,
      strongHash,
      now,
      now,
      byPath.id,
    );
    return strongHash;
  }

  const deletedCandidates = p.findDeletedByQuickFingerprint.all(
    libraryId,
    item.quickFingerprint,
    recentTombstoneThreshold,
  ) as Array<{ id: string; strong_hash: string | null }>;

  const resurrectCandidate = pickResurrectCandidate(deletedCandidates, strongHash);
  if (resurrectCandidate) {
    p.updateExistingById.run(
      item.absolutePath,
      item.volumeId,
      item.osFileId,
      item.stats.size,
      Math.trunc(item.stats.mtimeMs),
      Math.trunc(item.stats.ctimeMs),
      item.quickFingerprint,
      strongHash,
      now,
      now,
      resurrectCandidate.id,
    );
    return strongHash;
  }

  p.insertOrUpdateByPath.run(
    randomUUID(),
    libraryId,
    item.absolutePath,
    item.volumeId,
    item.osFileId,
    item.stats.size,
    Math.trunc(item.stats.mtimeMs),
    Math.trunc(item.stats.ctimeMs),
    item.quickFingerprint,
    strongHash,
    now,
    now,
    now,
  );
  return strongHash;
}

/**
 * Re-stat, re-hash, and upsert one or more `fs_objects` rows without folder tombstoning.
 * Use after embedded metadata writes so `strong_hash` / mtime match disk before `upsertMediaItemFromFilePath`.
 */
export async function refreshObservedStateForPaths(
  filePaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Promise<Record<string, ObservedFileState>> {
  if (filePaths.length === 0) {
    return {};
  }

  const db = getDesktopDatabase();
  const p = getFsObjectPersistence(db);
  const recentTombstoneThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const touchedStrongHashes = new Set<string>();

  for (const absolutePath of filePaths) {
    const trimmed = absolutePath.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const stats = await fs.stat(trimmed);
      if (!stats.isFile()) {
        continue;
      }
      const volumeId = String(stats.dev);
      const osFileId = String(stats.ino);
      const quickFingerprint = `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
      const item: ObservedFile = {
        absolutePath: trimmed,
        stats,
        volumeId,
        osFileId,
        quickFingerprint,
      };
      const strongHash = await persistObservedFileIntoFsObjects({
        libraryId,
        item,
        persistence: p,
        recentTombstoneThreshold,
      });
      if (strongHash) {
        touchedStrongHashes.add(strongHash);
      }
    } catch {
      // missing or unreadable path
    }
  }

  for (const h of touchedStrongHashes) {
    refreshDuplicateGrouping(h, libraryId);
  }

  return getObservedFileStateByPaths(filePaths, libraryId);
}

export interface ObservedFileState {
  currentPath: string;
  fileSize: number | null;
  mtimeMs: number | null;
  ctimeMs: number | null;
  quickFingerprint: string | null;
  strongHash: string | null;
  duplicateGroupId: string | null;
  lastSeenAt: string;
}

export async function observeFiles(
  filePaths: string[],
  folderPath: string,
  libraryId = DEFAULT_LIBRARY_ID,
  onProgress?: (processed: number, total: number) => void,
  isCancelled?: () => boolean,
): Promise<void> {
  if (filePaths.length === 0) {
    markFolderFilesDeleted(folderPath, new Set<string>(), libraryId);
    onProgress?.(0, 0);
    return;
  }

  // const observeT0 = Date.now();
  // const ts = () => `+${Date.now() - observeT0}ms`;
  // console.log(`[observeFiles][${ts()}] START folder=${folderPath} files=${filePaths.length}`);
  const observed: ObservedFile[] = [];
  let discovered = 0;
  const totalToDiscover = filePaths.length;
  for (const absolutePath of filePaths) {
    if (isCancelled?.()) {
      // console.log(`[observeFiles][${ts()}] stat loop CANCELLED at ${discovered}/${totalToDiscover}`);
      break;
    }
    discovered += 1;
    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isFile()) {
        const volumeId = String(stats.dev);
        const osFileId = String(stats.ino);
        const quickFingerprint = `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
        observed.push({
          absolutePath,
          stats,
          volumeId,
          osFileId,
          quickFingerprint,
        });
      }
    } catch {
      // Best-effort identity indexing, skip files that disappear during scan.
    }
    onProgress?.(discovered, totalToDiscover);
  }
  // console.log(`[observeFiles][${ts()}] stat loop DONE discovered=${discovered} observed=${observed.length}`);

  if (observed.length === 0) {
    if (!isCancelled?.()) {
      markFolderFilesDeleted(folderPath, new Set<string>(), libraryId);
    }
    return;
  }

  const db = getDesktopDatabase();
  const p = getFsObjectPersistence(db);
  const activeSeenPaths = new Set<string>();
  const touchedStrongHashes = new Set<string>();
  const recentTombstoneThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

  for (const item of observed) {
    if (isCancelled?.()) {
      break;
    }
    activeSeenPaths.add(item.absolutePath);
    const strongHash = await persistObservedFileIntoFsObjects({
      libraryId,
      item,
      persistence: p,
      recentTombstoneThreshold,
    });
    if (strongHash) {
      touchedStrongHashes.add(strongHash);
    }
  }

  for (const strongHash of touchedStrongHashes) {
    refreshDuplicateGrouping(strongHash, libraryId);
  }

  if (!isCancelled?.()) {
    markFolderFilesDeleted(folderPath, activeSeenPaths, libraryId);
  }
  // console.log(`[observeFiles][${ts()}] END`);
}

export function getObservedFileStateByPaths(
  filePaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, ObservedFileState> {
  if (filePaths.length === 0) {
    return {};
  }

  const db = getDesktopDatabase();
  const sql = `SELECT
         current_path,
         file_size,
         mtime_ms,
         ctime_ms,
         quick_fingerprint,
         strong_hash,
         duplicate_group_id,
         last_seen_at
       FROM fs_objects
       WHERE library_id = ?
         AND deleted_at IS NULL
         AND current_path IN (`;

  type Row = {
    current_path: string;
    file_size: number | null;
    mtime_ms: number | null;
    ctime_ms: number | null;
    quick_fingerprint: string | null;
    strong_hash: string | null;
    duplicate_group_id: string | null;
    last_seen_at: string;
  };

  const acc: Record<string, ObservedFileState> = {};

  for (let i = 0; i < filePaths.length; i += OBSERVED_PATHS_QUERY_CHUNK) {
    const chunk = filePaths.slice(i, i + OBSERVED_PATHS_QUERY_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db.prepare(sql + placeholders + `)`).all(libraryId, ...chunk) as Row[];

    for (const row of rows) {
      acc[row.current_path] = {
        currentPath: row.current_path,
        fileSize: row.file_size,
        mtimeMs: row.mtime_ms,
        ctimeMs: row.ctime_ms,
        quickFingerprint: row.quick_fingerprint,
        strongHash: row.strong_hash,
        duplicateGroupId: row.duplicate_group_id,
        lastSeenAt: row.last_seen_at,
      };
    }
  }

  return acc;
}

function pickResurrectCandidate(
  candidates: Array<{ id: string; strong_hash: string | null }>,
  strongHash: string | null,
): { id: string } | null {
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return { id: candidates[0].id };
  }
  if (!strongHash) {
    return null;
  }
  const withSameStrongHash = candidates.find((candidate) => candidate.strong_hash === strongHash);
  return withSameStrongHash ? { id: withSameStrongHash.id } : null;
}

function refreshDuplicateGrouping(strongHash: string, libraryId: string): void {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT id
       FROM fs_objects
       WHERE library_id = ? AND strong_hash = ? AND deleted_at IS NULL`,
    )
    .all(libraryId, strongHash) as Array<{ id: string }>;

  if (rows.length < 2) {
    db.prepare(
      `UPDATE fs_objects
       SET duplicate_group_id = NULL
       WHERE library_id = ? AND strong_hash = ?`,
    ).run(libraryId, strongHash);
    return;
  }

  const duplicateGroupId = `dup:${strongHash}`;
  db.prepare(
    `UPDATE fs_objects
     SET duplicate_group_id = ?
     WHERE library_id = ? AND strong_hash = ? AND deleted_at IS NULL`,
  ).run(duplicateGroupId, libraryId, strongHash);
}

function markFolderFilesDeleted(
  folderPath: string,
  observedPaths: Set<string>,
  libraryId: string,
): void {
  const db = getDesktopDatabase();
  const folderPrefix = folderPath.endsWith(path.sep) ? folderPath : `${folderPath}${path.sep}`;
  const candidates = db
    .prepare(
      `SELECT id, current_path
       FROM fs_objects
       WHERE library_id = ? AND deleted_at IS NULL
         AND (current_path = ? OR instr(current_path, ?) = 1)`,
    )
    .all(libraryId, folderPath, folderPrefix) as Array<{ id: string; current_path: string }>;

  if (candidates.length === 0) {
    return;
  }

  const toDelete = candidates.filter(
    (row) => path.dirname(row.current_path) === folderPath && !observedPaths.has(row.current_path),
  );
  if (toDelete.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const markDeleted = db.prepare(
    `UPDATE fs_objects
     SET deleted_at = ?, updated_at = ?
     WHERE id = ?`,
  );
  const tx = db.transaction((rows: Array<{ id: string }>) => {
    for (const row of rows) {
      markDeleted.run(now, now, row.id);
    }
  });
  tx(toDelete);
}

function propagatePathChange(
  oldPath: string,
  newPath: string,
  libraryId: string,
): void {
  const result = updateSourcePath({ oldPath, newPath, libraryId });

  if (result) {
    const db = getDesktopDatabase();
    if (result.wasPrimary) {
      const newBasename = path.basename(newPath);
      db.prepare(
        `UPDATE media_items
         SET source_path = ?, filename = ?, updated_at = ?
         WHERE id = ? AND library_id = ?`,
      ).run(newPath, newBasename, new Date().toISOString(), result.mediaItemId, libraryId);
    }
    console.log(
      `[file-identity] path change propagated: ${oldPath} -> ${newPath} (mediaItemId=${result.mediaItemId})`,
    );
  }
}

async function maybeComputeStrongHash(
  absolutePath: string,
  fileSize: number,
): Promise<string | null> {
  const maxHashBytes = 128 * 1024 * 1024;
  if (fileSize > maxHashBytes) {
    return null;
  }

  return computeSha256(absolutePath);
}

async function computeSha256(absolutePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absolutePath);
    stream.on("error", () => resolve(null));
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
