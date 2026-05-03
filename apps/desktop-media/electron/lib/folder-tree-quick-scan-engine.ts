import path from "node:path";
import { performance } from "node:perf_hooks";
import type { FolderTreeQuickScanResult, QuickScanMovedFileMatchMode } from "../../src/shared/ipc";
import { getDesktopDatabase } from "../db/client";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { getFolderMetadataScanCompletedAtByPath } from "../db/folder-summary-overview";
import {
  countQuickScanSnapshotsUnderRoot,
  getDirMtimeSnapshotsForPaths,
  upsertQuickScanSnapshots,
} from "../db/folder-quick-scan-snapshot";
import { collectDiskFolderQuickScanLayout, sigFromSortedLines } from "./folder-tree-quick-scan-disk-layout";
import { listFolderPathsWithDirectMediaOnDisk } from "./folder-tree-quick-scan-coverage";
import {
  pairQuickScanMoves,
  parentFolderForFilePath,
  type PendingDeletedCatalog,
  type PendingNewDisk,
} from "./folder-tree-quick-scan-moves";

/** When false, skip mtime snapshot compare + DB upserts; only the catalog diff runs after the disk walk. */
const ENABLE_ULTRA_FOLDER_QUICK_SCAN = false;
/** Set to true only while diagnosing quick-scan result mismatches. */
const DEBUG_FOLDER_TREE_SCAN_RESULT_SUMMARY = false;

const SAMPLE_CAP = 120;
const METADATA_SCAN_PATH_CHUNK = 400;

function metadataScanCompletedAtByPathsChunked(
  folderPaths: string[],
  libraryId: string,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < folderPaths.length; i += METADATA_SCAN_PATH_CHUNK) {
    const slice = folderPaths.slice(i, i + METADATA_SCAN_PATH_CHUNK);
    Object.assign(out, getFolderMetadataScanCompletedAtByPath(slice, libraryId));
  }
  return out;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

function scopeLikePatterns(rootPath: string): { exact: string; like: string } {
  const normalized = path.normalize(rootPath.trim());
  const sep = normalized.includes("\\") ? "\\" : "/";
  const withSep = normalized.endsWith(sep) ? normalized : `${normalized}${sep}`;
  return {
    exact: normalized,
    like: `${escapeLikePattern(withSep)}%`,
  };
}

function takeSample(paths: string[], cap: number): string[] {
  if (paths.length <= cap) return [...paths];
  return paths.slice(0, cap);
}

export async function runFolderTreeQuickScans(params: {
  rootFolderPath: string;
  libraryId?: string;
  movedMatchMode: QuickScanMovedFileMatchMode;
}): Promise<FolderTreeQuickScanResult> {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const root = path.normalize(params.rootFolderPath.trim());
  const movedMatchMode = params.movedMatchMode;

  const walkT0 = performance.now();
  const diskLayout = await collectDiskFolderQuickScanLayout(root);
  const diskLayoutWalkMs = Math.round(performance.now() - walkT0);
  const { folderDirMtimes, folderMediaLines } = diskLayout;

  const allFolderPaths = Array.from(folderDirMtimes.keys());
  const priorCount = countQuickScanSnapshotsUnderRoot(root, libraryId);
  const baseline = priorCount === 0;

  let ultraCompareAndSnapshotMs = 0;
  let ultraChanged = 0;
  if (ENABLE_ULTRA_FOLDER_QUICK_SCAN) {
    const snapshotT0 = performance.now();
    const { folderSubdirs } = diskLayout;
    if (!baseline) {
      const prior = getDirMtimeSnapshotsForPaths(allFolderPaths, libraryId);
      for (const fp of allFolderPaths) {
        const cur = folderDirMtimes.get(fp);
        if (cur == null) continue;
        const prev = prior.get(fp);
        if (prev == null || prev !== cur) {
          ultraChanged += 1;
        }
      }
    }

    const snapshotRows = allFolderPaths.map((fp) => ({
      folderPath: fp,
      dirMtimeMs: folderDirMtimes.get(fp) ?? 0,
      subdirNamesSig: sigFromSortedLines(folderSubdirs.get(fp) ?? []),
      mediaFilesSig: sigFromSortedLines(folderMediaLines.get(fp) ?? []),
    }));
    upsertQuickScanSnapshots(snapshotRows, libraryId);

    ultraCompareAndSnapshotMs = Math.round(performance.now() - snapshotT0);
  }

  const ultraMs = ENABLE_ULTRA_FOLDER_QUICK_SCAN ? diskLayoutWalkMs + ultraCompareAndSnapshotMs : 0;

  const normalT0 = performance.now();
  const diskMedia = new Map<string, { mtime: number; size: number; folderPath: string; filename: string }>();
  for (const fp of allFolderPaths) {
    const lines = folderMediaLines.get(fp) ?? [];
    for (const line of lines) {
      const parts = line.split("|");
      const name = parts[0];
      const m = Number(parts[1]);
      const sz = Number(parts[2]);
      if (!name || !Number.isFinite(m) || !Number.isFinite(sz)) continue;
      const fullPath = path.normalize(path.join(fp, name));
      diskMedia.set(fullPath, { mtime: m, size: sz, folderPath: fp, filename: name });
    }
  }

  const { exact, like } = scopeLikePatterns(root);
  const catalog = new Map<
    string,
    { mtime: number | null; size: number | null; contentHash: string | null }
  >();

  const db = getDesktopDatabase();
  const stmt = db.prepare(
    `SELECT source_path, file_mtime_ms, byte_size, content_hash
     FROM media_items
     WHERE library_id = ?
       AND deleted_at IS NULL
       AND (source_path = ? OR source_path LIKE ? ESCAPE '~')`,
  );
  const rows = stmt.all(libraryId, exact, like) as Array<{
    source_path: string;
    file_mtime_ms: number | null;
    byte_size: number | null;
    content_hash: string | null;
  }>;
  for (const row of rows) {
    const p = path.normalize(row.source_path);
    catalog.set(p, {
      mtime: row.file_mtime_ms,
      size: row.byte_size,
      contentHash: row.content_hash,
    });
  }

  const newPaths: string[] = [];
  const modifiedPaths: string[] = [];
  const pendingDeleted: PendingDeletedCatalog[] = [];
  const pendingNew: PendingNewDisk[] = [];

  for (const [p, d] of diskMedia) {
    const c = catalog.get(p);
    if (!c) {
      newPaths.push(p);
      pendingNew.push({
        path: p,
        folderPath: d.folderPath,
        filename: d.filename,
        byteSize: d.size,
      });
      continue;
    }
    const m = c.mtime;
    const sz = c.size;
    if (m !== d.mtime || sz !== d.size) {
      modifiedPaths.push(p);
    }
  }

  for (const [p, c] of catalog) {
    if (!diskMedia.has(p)) {
      pendingDeleted.push({
        sourcePath: p,
        folderPath: parentFolderForFilePath(p),
        filename: path.basename(p),
        byteSize: c.size,
        contentHash: c.contentHash,
      });
    }
  }

  const { moves, remainingDeleted, remainingNew } = await pairQuickScanMoves({
    pendingDeleted,
    pendingNew,
    mode: movedMatchMode,
  });

  const deletedPaths = remainingDeleted.map((d) => d.sourcePath);
  const finalNewPaths = remainingNew.map((n) => n.path);

  const nmFolders = new Set<string>();
  for (const p of modifiedPaths) {
    nmFolders.add(parentFolderForFilePath(p));
  }
  for (const p of finalNewPaths) {
    nmFolders.add(parentFolderForFilePath(p));
  }

  const normalMs = Math.round(performance.now() - normalT0);
  const normalTotalMs = diskLayoutWalkMs + normalMs;

  const pathsWithDirectMedia = listFolderPathsWithDirectMediaOnDisk(allFolderPaths, folderMediaLines);
  const treeFoldersWithDirectMediaOnDiskCount = pathsWithDirectMedia.length;
  const fullScanAtByFolder = metadataScanCompletedAtByPathsChunked(pathsWithDirectMedia, libraryId);
  let treeFoldersWithMetadataFolderScanCount = 0;
  let oldestMetadataFolderScanAtAmongWalkedFolders: string | null = null;
  for (const fp of pathsWithDirectMedia) {
    const at = fullScanAtByFolder[fp];
    if (at != null) {
      treeFoldersWithMetadataFolderScanCount += 1;
      if (
        oldestMetadataFolderScanAtAmongWalkedFolders == null ||
        at < oldestMetadataFolderScanAtAmongWalkedFolders
      ) {
        oldestMetadataFolderScanAtAmongWalkedFolders = at;
      }
    }
  }

  const result: FolderTreeQuickScanResult = {
    ultraFastScanMs: ultraMs,
    normalScanMs: normalMs,
    normalTotalMs,
    ultraChangedFolderCount: baseline ? 0 : ultraChanged,
    ultraFoldersScanned: allFolderPaths.length,
    ultraBaselineSeeded: baseline,
    treeFoldersWithDirectMediaOnDiskCount,
    treeFoldersWithMetadataFolderScanCount,
    oldestMetadataFolderScanAtAmongWalkedFolders,
    newFileCount: finalNewPaths.length,
    modifiedFileCount: modifiedPaths.length,
    deletedFileCount: deletedPaths.length,
    movedFileCount: moves.length,
    newOrModifiedFolderCount: nmFolders.size,
    movedMatchModeUsed: movedMatchMode,
    deletedSamplePaths: takeSample(deletedPaths, SAMPLE_CAP),
    movedItems: moves,
    newSamplePaths: takeSample(finalNewPaths, SAMPLE_CAP),
    modifiedSamplePaths: takeSample(modifiedPaths, SAMPLE_CAP),
  };

  if (DEBUG_FOLDER_TREE_SCAN_RESULT_SUMMARY) {
    console.log("[debug][folder-tree-scan]", "resultSummary", {
      root,
      treeFoldersWithDirectMediaOnDiskCount: result.treeFoldersWithDirectMediaOnDiskCount,
      treeFoldersWithMetadataFolderScanCount: result.treeFoldersWithMetadataFolderScanCount,
      newFileCount: result.newFileCount,
      modifiedFileCount: result.modifiedFileCount,
      deletedFileCount: result.deletedFileCount,
      movedFileCount: result.movedFileCount,
      newOrModifiedFolderCount: result.newOrModifiedFolderCount,
      newSamplePaths: result.newSamplePaths,
      modifiedSamplePaths: result.modifiedSamplePaths,
      movedItems: result.movedItems,
    });
  }

  return result;
}
