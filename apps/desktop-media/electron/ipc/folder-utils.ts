import path from "node:path";
import { randomUUID } from "node:crypto";
import { listFolderImages, listFolderVideos, readFolderChildren } from "../fs-media";
import { getDesktopDatabase } from "../db/client";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { upsertMediaItemFromFilePath } from "../db/media-item-metadata";
import { DEFAULT_CONCURRENCY, MAX_CONCURRENCY } from "./state";

const PREPARE_YIELD_EVERY = 25;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export interface FolderPrepareProgress {
  step: "collecting-folders" | "collecting-images" | "collecting-library-files" | "ensuring-catalog";
  processed: number;
  total: number | null;
}

type ProgressReporter = (progress: FolderPrepareProgress) => void;

export async function collectFoldersRecursively(rootFolderPath: string): Promise<string[]> {
  return collectFoldersRecursivelyWithProgress(rootFolderPath);
}

export async function collectFoldersRecursivelyWithProgress(
  rootFolderPath: string,
  onProgress?: ProgressReporter,
): Promise<string[]> {
  const folders: string[] = [];
  const queue: string[] = [rootFolderPath];
  const seen = new Set<string>();
  let processed = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);
    folders.push(current);
    processed += 1;
    if (onProgress) {
      onProgress({
        step: "collecting-folders",
        processed,
        total: null,
      });
    }
    try {
      const children = await readFolderChildren(current);
      children.forEach((child) => queue.push(child.path));
    } catch (err) {
      console.warn(
        `[folder-utils] readFolderChildren failed for ${current}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (processed % PREPARE_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  return folders;
}

export async function collectImageEntriesForFolders(
  folderPaths: string[],
): Promise<Array<{ folderPath: string; path: string; name: string }>> {
  return collectImageEntriesForFoldersWithProgress(folderPaths);
}

export async function collectImageEntriesForFoldersWithProgress(
  folderPaths: string[],
  onProgress?: ProgressReporter,
): Promise<Array<{ folderPath: string; path: string; name: string }>> {
  const allEntries: Array<{ folderPath: string; path: string; name: string }> = [];

  for (let i = 0; i < folderPaths.length; i += 1) {
    const folderPath = folderPaths[i];
    try {
      const images = await listFolderImages(folderPath);
      allEntries.push(
        ...images.map((image) => ({
          folderPath,
          path: image.path,
          name: image.name,
        })),
      );
    } catch {
      // Continue with other folders when one folder cannot be read.
    }
    if (onProgress) {
      onProgress({
        step: "collecting-images",
        processed: i + 1,
        total: folderPaths.length,
      });
    }
    if ((i + 1) % PREPARE_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  return allEntries;
}

/** Images and videos for metadata scan / reconciliation (sorted per folder: images then videos by name). */
export async function collectLibraryFileEntriesForFolders(
  folderPaths: string[],
): Promise<Array<{ folderPath: string; path: string; name: string }>> {
  return collectLibraryFileEntriesForFoldersWithProgress(folderPaths);
}

export async function collectLibraryFileEntriesForFoldersWithProgress(
  folderPaths: string[],
  onProgress?: ProgressReporter,
): Promise<Array<{ folderPath: string; path: string; name: string }>> {
  const allEntries: Array<{ folderPath: string; path: string; name: string }> = [];

  for (let i = 0; i < folderPaths.length; i += 1) {
    const folderPath = folderPaths[i];
    try {
      const [images, videos] = await Promise.all([
        listFolderImages(folderPath),
        listFolderVideos(folderPath),
      ]);
      allEntries.push(
        ...images.map((image) => ({
          folderPath,
          path: image.path,
          name: image.name,
        })),
        ...videos.map((video) => ({
          folderPath,
          path: video.path,
          name: video.name,
        })),
      );
    } catch {
      // Continue with other folders when one folder cannot be read.
    }
    if (onProgress) {
      onProgress({
        step: "collecting-library-files",
        processed: i + 1,
        total: folderPaths.length,
      });
    }
    if ((i + 1) % PREPARE_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  return allEntries;
}

export function clampConcurrency(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_CONCURRENCY;
  }
  return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(value)));
}

const CATALOG_CHUNK = 900;

/**
 * Clear soft-delete on a row matching this file path (same path rules as path analysis lookup).
 * Without this, `ensureCatalogForImages` used to treat deleted rows as "existing" and skip insert,
 * while pipelines only see active rows (`deleted_at IS NULL`) — causing persist failures.
 */
function reviveSoftDeletedMediaItemByPath(
  db: ReturnType<typeof getDesktopDatabase>,
  libraryId: string,
  filePath: string,
  now: string,
): boolean {
  const normalized = path.normalize(filePath);
  const attempts = [normalized];
  const slashVariant = normalized.includes("\\")
    ? normalized.replace(/\\/g, "/")
    : normalized.replace(/\//g, "\\");
  if (slashVariant !== normalized) {
    attempts.push(slashVariant);
  }

  const stmt = db.prepare(
    `UPDATE media_items SET deleted_at = NULL, updated_at = ?
     WHERE library_id = ? AND source_path = ? AND deleted_at IS NOT NULL`,
  );
  for (const p of attempts) {
    const info = stmt.run(now, libraryId, p);
    if (info.changes > 0) {
      return true;
    }
  }

  if (process.platform === "win32") {
    const info = db
      .prepare(
        `UPDATE media_items SET deleted_at = NULL, updated_at = ?
         WHERE library_id = ? AND lower(source_path) = lower(?) AND deleted_at IS NOT NULL`,
      )
      .run(now, libraryId, normalized);
    if (info.changes > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Ensure every image path has a `media_items` row (minimal insert if missing).
 * This makes folder-level coverage queries accurate even when the user has not
 * run "Scan for file changes" (with sub-folders if needed) before starting an AI pipeline.
 */
export function ensureCatalogForImages(
  imagePaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  ensureCatalogForImagesCore(imagePaths, libraryId);
}

export async function ensureCatalogForImagesWithProgress(
  imagePaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
  onProgress?: ProgressReporter,
): Promise<void> {
  if (imagePaths.length === 0) return;
  const db = getDesktopDatabase();
  const sqlPrefix = `SELECT source_path FROM media_items WHERE library_id = ? AND deleted_at IS NULL AND source_path IN (`;
  const sqlSuffix = `)`;
  const existing = new Set<string>();
  for (let i = 0; i < imagePaths.length; i += CATALOG_CHUNK) {
    const chunk = imagePaths.slice(i, i + CATALOG_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      existing.add(row.source_path);
    }
    if (onProgress) {
      onProgress({
        step: "ensuring-catalog",
        processed: Math.min(i + CATALOG_CHUNK, imagePaths.length),
        total: imagePaths.length,
      });
    }
    await yieldToEventLoop();
  }

  const missing = imagePaths.filter((p) => !existing.has(p));
  if (missing.length === 0) return;
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO media_items (id, library_id, source_path, filename, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  let revived = 0;
  let inserted = 0;

  for (let i = 0; i < missing.length; i += CATALOG_CHUNK) {
    const chunk = missing.slice(i, i + CATALOG_CHUNK);
    const tx = db.transaction((items: string[]) => {
      for (const filePath of items) {
        if (reviveSoftDeletedMediaItemByPath(db, libraryId, filePath, now)) {
          revived++;
          continue;
        }
        const info = insert.run(randomUUID(), libraryId, filePath, path.basename(filePath), now, now);
        if (info.changes > 0) {
          inserted++;
        }
      }
    });
    tx(chunk);
    await yieldToEventLoop();
  }
  if (revived > 0 || inserted > 0) {
    console.log(
      `[folder-utils] ensureCatalogForImages: revived=${revived} inserted=${inserted} (candidate_missing=${missing.length})`,
    );
  }
}

function ensureCatalogForImagesCore(
  imagePaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
  onProgress?: ProgressReporter,
): void {
  if (imagePaths.length === 0) return;
  const db = getDesktopDatabase();
  const sqlPrefix = `SELECT source_path FROM media_items WHERE library_id = ? AND deleted_at IS NULL AND source_path IN (`;
  const sqlSuffix = `)`;
  const existing = new Set<string>();

  for (let i = 0; i < imagePaths.length; i += CATALOG_CHUNK) {
    const chunk = imagePaths.slice(i, i + CATALOG_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      existing.add(row.source_path);
    }
    if (onProgress) {
      onProgress({
        step: "ensuring-catalog",
        processed: Math.min(i + CATALOG_CHUNK, imagePaths.length),
        total: imagePaths.length,
      });
    }
  }

  const missing = imagePaths.filter((p) => !existing.has(p));
  if (missing.length === 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO media_items (id, library_id, source_path, filename, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  let revived = 0;
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const filePath of missing) {
      if (reviveSoftDeletedMediaItemByPath(db, libraryId, filePath, now)) {
        revived++;
        continue;
      }
      const info = insert.run(randomUUID(), libraryId, filePath, path.basename(filePath), now, now);
      if (info.changes > 0) {
        inserted++;
      }
    }
  });
  tx();
  if (revived > 0 || inserted > 0) {
    console.log(
      `[folder-utils] ensureCatalogForImages: revived=${revived} inserted=${inserted} (candidate_missing=${missing.length})`,
    );
  }
}

/**
 * If the image does not yet have extracted metadata (metadata_extracted_at is
 * NULL), run a full metadata extraction so that timestamps are consistent
 * before any AI pipeline processes the file.
 */
export async function ensureMetadataForImage(
  imagePath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): Promise<void> {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT metadata_extracted_at FROM media_items
       WHERE library_id = ? AND source_path = ? AND metadata_extracted_at IS NOT NULL
       LIMIT 1`,
    )
    .get(libraryId, imagePath) as { metadata_extracted_at: string } | undefined;

  if (row) return;

  try {
    await upsertMediaItemFromFilePath({ filePath: imagePath, libraryId });
  } catch (err) {
    console.warn(
      `[folder-utils] ensureMetadataForImage failed for ${imagePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
