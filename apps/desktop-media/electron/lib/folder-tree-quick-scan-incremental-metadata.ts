import path from "node:path";
import type { QuickScanMovedFileMatchMode } from "../../src/shared/ipc";
import { computeFolderTreeQuickScanDiff, type FolderTreeQuickScanDiff } from "./folder-tree-quick-scan-compute";
import { parentFolderForFilePath } from "./folder-tree-quick-scan-moves";

export interface IncrementalMetadataScanPlan {
  knownCatalogEntries: Array<{ folderPath: string; path: string; name: string }>;
  /** Full on-disk direct file paths per folder that needs reconciliation (incremental scan only). */
  incrementalReconcileObservedByFolder: Map<string, Set<string>>;
}

function catalogEntry(filePath: string): { folderPath: string; path: string; name: string } {
  const normalized = path.normalize(filePath);
  return {
    folderPath: parentFolderForFilePath(normalized),
    path: normalized,
    name: path.basename(normalized),
  };
}

function affectedFoldersFromDiff(diff: FolderTreeQuickScanDiff): Set<string> {
  const affected = new Set<string>();
  const add = (filePath: string): void => {
    affected.add(parentFolderForFilePath(path.normalize(filePath)));
  };
  for (const p of diff.finalNewPaths) add(p);
  for (const p of diff.modifiedPaths) add(p);
  for (const p of diff.deletedPaths) add(p);
  for (const m of diff.moves) {
    add(m.previousPath);
    add(m.newPath);
  }
  return affected;
}

function buildReconcileObservedByFolder(diff: FolderTreeQuickScanDiff): Map<string, Set<string>> {
  const reconcileObservedByFolder = new Map<string, Set<string>>();
  const affected = affectedFoldersFromDiff(diff);
  for (const folder of affected) {
    const set = new Set<string>();
    for (const [fullPath, meta] of diff.diskMedia) {
      if (meta.folderPath === folder) {
        set.add(fullPath);
      }
    }
    reconcileObservedByFolder.set(folder, set);
  }
  return reconcileObservedByFolder;
}

function pathsToUpsert(diff: FolderTreeQuickScanDiff): Set<string> {
  const paths = new Set<string>();
  for (const p of diff.finalNewPaths) paths.add(path.normalize(p));
  for (const p of diff.modifiedPaths) paths.add(path.normalize(p));
  for (const m of diff.moves) {
    paths.add(path.normalize(m.previousPath));
    paths.add(path.normalize(m.newPath));
  }
  return paths;
}

/**
 * Builds a partial metadata scan over files the quick scan flagged, plus per-folder reconcile sets
 * so neighbors are not incorrectly soft-deleted.
 */
export async function buildIncrementalMetadataScanPlan(params: {
  rootFolderPath: string;
  libraryId?: string;
  movedMatchMode: QuickScanMovedFileMatchMode;
}): Promise<IncrementalMetadataScanPlan> {
  const diff = await computeFolderTreeQuickScanDiff(params);
  const pathSet = pathsToUpsert(diff);
  const knownCatalogEntries = [...pathSet].map((p) => catalogEntry(p));
  const incrementalReconcileObservedByFolder = buildReconcileObservedByFolder(diff);
  return { knownCatalogEntries, incrementalReconcileObservedByFolder };
}
