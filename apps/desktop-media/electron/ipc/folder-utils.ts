import path from "node:path";
import { randomUUID } from "node:crypto";
import { listFolderImages, readFolderChildren } from "../fs-media";
import { getDesktopDatabase } from "../db/client";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { upsertMediaItemFromFilePath } from "../db/media-item-metadata";
import { DEFAULT_CONCURRENCY, MAX_CONCURRENCY } from "./state";

export async function collectFoldersRecursively(rootFolderPath: string): Promise<string[]> {
  const folders: string[] = [];
  const queue: string[] = [rootFolderPath];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);
    folders.push(current);
    try {
      const children = await readFolderChildren(current);
      children.forEach((child) => queue.push(child.path));
    } catch (err) {
      console.warn(
        `[folder-utils] readFolderChildren failed for ${current}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return folders;
}

export async function collectImageEntriesForFolders(
  folderPaths: string[],
): Promise<Array<{ folderPath: string; path: string; name: string }>> {
  const allEntries: Array<{ folderPath: string; path: string; name: string }> = [];

  for (const folderPath of folderPaths) {
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
