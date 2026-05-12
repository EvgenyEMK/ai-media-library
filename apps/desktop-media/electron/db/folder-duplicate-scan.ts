import fs from "node:fs/promises";
import path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import type {
  FolderDuplicateScanDuplicateEntry,
  FolderDuplicateScanResultPayload,
  FolderDuplicateScanRow,
} from "../../src/shared/ipc";
import { computeStrongHashWithinSizeLimit } from "./file-identity";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import {
  isMediaPathInFolderScope,
  scopeLikePatterns,
} from "../lib/folder-duplicate-scan-scope";
import { bucketWeakDuplicateRows } from "../lib/folder-duplicate-scan-weak";

const MAX_HASH_BYTES = 128 * 1024 * 1024;
const PROGRESS_REPORT_INTERVAL = 100;
interface CatalogRow {
  id: string;
  source_path: string;
  byte_size: number | null;
  file_mtime_ms: number | null;
  photo_taken_at: string | null;
  photo_taken_precision: string | null;
  content_hash: string | null;
  media_kind: string | null;
}

function normalizeMediaKind(raw: string | null): "image" | "video" {
  return raw === "video" ? "video" : "image";
}

function rowToDuplicateEntry(r: {
  id: string;
  source_path: string;
  byte_size: number | null;
  file_mtime_ms: number | null;
  photo_taken_at: string | null;
  photo_taken_precision: string | null;
}): FolderDuplicateScanDuplicateEntry {
  return {
    mediaItemId: r.id,
    sourcePath: r.source_path,
    byteSize: r.byte_size,
    fileMtimeMs: r.file_mtime_ms,
    photoTakenAt: r.photo_taken_at,
    photoTakenPrecision: r.photo_taken_precision,
  };
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) {
    const err = new Error("Aborted");
    err.name = "AbortError";
    throw err;
  }
}

function shouldReportProgress(processed: number, total: number): boolean {
  return processed === 1 || processed === total || processed % PROGRESS_REPORT_INTERVAL === 0;
}

async function yieldForCancellation(processed: number, signal: AbortSignal): Promise<void> {
  if (processed > 0) {
    await yieldToEventLoop();
    abortIfNeeded(signal);
  }
}

export async function runFolderDuplicateScan(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
  signal: AbortSignal;
  onProgress?: (processed: number, total: number, message: string) => void;
}): Promise<FolderDuplicateScanResultPayload> {
  const folderPath = params.folderPath.trim();
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const { exact, like } = scopeLikePatterns(folderPath);
  const db = getDesktopDatabase();

  const rawRows = db
    .prepare(
      `SELECT id, source_path, byte_size, file_mtime_ms, photo_taken_at, photo_taken_precision,
              content_hash, media_kind
       FROM media_items
       WHERE library_id = ?
         AND deleted_at IS NULL
         AND (source_path = ? OR source_path LIKE ? ESCAPE '~')`,
    )
    .all(libraryId, exact, like) as CatalogRow[];

  const scoped: CatalogRow[] = [];
  for (let ri = 0; ri < rawRows.length; ri++) {
    abortIfNeeded(params.signal);
    const row = rawRows[ri]!;
    if (isMediaPathInFolderScope(row.source_path, exact, params.recursive)) {
      scoped.push(row);
    }
    await yieldForCancellation(ri + 1, params.signal);
  }

  const runtimeHashByPath = new Map<string, string>();
  let skippedLargeFileCount = 0;
  let skippedMissingOnDiskCount = 0;
  let skippedHashUnresolvedCount = 0;

  const needsRuntimeHash = scoped.filter((r) => !r.content_hash || r.content_hash.length === 0);
  const hashTotal = needsRuntimeHash.length;

  for (let hi = 0; hi < needsRuntimeHash.length; hi++) {
    abortIfNeeded(params.signal);
    const row = needsRuntimeHash[hi]!;
    const size = row.byte_size ?? 0;
    if (size > MAX_HASH_BYTES) {
      skippedLargeFileCount += 1;
      skippedHashUnresolvedCount += 1;
      if (shouldReportProgress(hi + 1, hashTotal)) {
        params.onProgress?.(
          hi + 1,
          hashTotal,
          `Skipped over limit (${path.basename(row.source_path)})`,
        );
      }
      await yieldForCancellation(hi + 1, params.signal);
      continue;
    }
    try {
      await fs.access(row.source_path);
    } catch {
      skippedMissingOnDiskCount += 1;
      skippedHashUnresolvedCount += 1;
      if (shouldReportProgress(hi + 1, hashTotal)) {
        params.onProgress?.(hi + 1, hashTotal, `Missing on disk`);
      }
      await yieldForCancellation(hi + 1, params.signal);
      continue;
    }
    const hash = await computeStrongHashWithinSizeLimit(row.source_path, size);
    if (hash) {
      runtimeHashByPath.set(row.source_path, hash);
    } else {
      skippedHashUnresolvedCount += 1;
    }
    if (shouldReportProgress(hi + 1, hashTotal)) {
      params.onProgress?.(hi + 1, hashTotal, `Hashing ${path.basename(row.source_path)}`);
    }
    await yieldForCancellation(hi + 1, params.signal);
  }

  function resolvedHashForCatalogRow(row: CatalogRow): string | null {
    return row.content_hash && row.content_hash.length > 0
      ? row.content_hash
      : runtimeHashByPath.get(row.source_path) ?? null;
  }

  const fetchDbByHash = db.prepare(
    `SELECT id, source_path, byte_size, file_mtime_ms, photo_taken_at, photo_taken_precision, media_kind
     FROM media_items
     WHERE library_id = ? AND content_hash = ? AND deleted_at IS NULL`,
  );

  function mergedGroupForHash(hash: string): Map<string, CatalogRow> {
    const byPath = new Map<string, CatalogRow>();
    const dbHits = fetchDbByHash.all(libraryId, hash) as Array<
      Omit<CatalogRow, "content_hash">
    >;
    for (const hit of dbHits) {
      const full: CatalogRow = {
        ...hit,
        content_hash: hash,
      };
      byPath.set(hit.source_path, full);
    }
    for (const [p, h] of runtimeHashByPath) {
      if (h !== hash) continue;
      if (!byPath.has(p)) {
        const self = scoped.find((s) => s.source_path === p);
        if (self) {
          byPath.set(p, self);
        }
      }
    }
    return byPath;
  }

  const rowsOut: FolderDuplicateScanRow[] = [];
  const checkTotal = scoped.length;

  for (let si = 0; si < scoped.length; si++) {
    abortIfNeeded(params.signal);
    const row = scoped[si]!;
    const resolvedHash = resolvedHashForCatalogRow(row);

    if (shouldReportProgress(si + 1, checkTotal)) {
      params.onProgress?.(
        si + 1,
        checkTotal,
        `Checking duplicates: ${path.basename(row.source_path)}`,
      );
    }

    if (!resolvedHash) {
      await yieldForCancellation(si + 1, params.signal);
      continue;
    }

    const group = mergedGroupForHash(resolvedHash);
    const others = [...group.values()].filter((r) => r.source_path !== row.source_path);
    if (others.length === 0) {
      await yieldForCancellation(si + 1, params.signal);
      continue;
    }

    rowsOut.push({
      scopedPath: row.source_path,
      mediaItemId: row.id,
      byteSize: row.byte_size,
      fileMtimeMs: row.file_mtime_ms,
      photoTakenAt: row.photo_taken_at,
      photoTakenPrecision: row.photo_taken_precision,
      mediaKind: normalizeMediaKind(row.media_kind),
      duplicates: others.map((r) => rowToDuplicateEntry(r)),
    });
    await yieldForCancellation(si + 1, params.signal);
  }

  const weakCandidates = scoped.filter((row) => !resolvedHashForCatalogRow(row));
  const weakBuckets = bucketWeakDuplicateRows(weakCandidates);

  for (const [, bucket] of weakBuckets) {
    abortIfNeeded(params.signal);
    if (bucket.length < 2) {
      continue;
    }
    bucket.sort((a, b) => a.source_path.localeCompare(b.source_path));
    for (let bi = 0; bi < bucket.length; bi++) {
      abortIfNeeded(params.signal);
      const row = bucket[bi]!;
      const others = bucket.filter((r) => r.source_path !== row.source_path);
      rowsOut.push({
        scopedPath: row.source_path,
        mediaItemId: row.id,
        byteSize: row.byte_size,
        fileMtimeMs: row.file_mtime_ms,
        photoTakenAt: row.photo_taken_at,
        photoTakenPrecision: row.photo_taken_precision,
        mediaKind: normalizeMediaKind(row.media_kind),
        duplicates: others.map((r) => rowToDuplicateEntry(r)),
        duplicateMatchBasis: "weak-metadata",
      });
      await yieldForCancellation(bi + 1, params.signal);
    }
  }

  await yieldForCancellation(1, params.signal);
  rowsOut.sort((a, b) => a.scopedPath.localeCompare(b.scopedPath));
  await yieldForCancellation(1, params.signal);

  return {
    folderPath,
    recursive: params.recursive,
    rows: rowsOut,
    skippedMissingContentHashCount: skippedHashUnresolvedCount,
    skippedLargeFileCount,
    skippedMissingOnDiskCount,
  };
}
