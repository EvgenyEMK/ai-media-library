import type { FolderTreeQuickScanResult, QuickScanMovedFileMatchMode } from "../../src/shared/ipc";
import { computeFolderTreeQuickScanDiff, type FolderTreeQuickScanDiff } from "./folder-tree-quick-scan-compute";
import { parentFolderForFilePath } from "./folder-tree-quick-scan-moves";

const SAMPLE_CAP = 120;

function takeSample(paths: string[], cap: number): string[] {
  if (paths.length <= cap) return [...paths];
  return paths.slice(0, cap);
}

function newOrModifiedFolderCount(diff: FolderTreeQuickScanDiff): number {
  const nmFolders = new Set<string>();
  for (const p of diff.modifiedPaths) {
    nmFolders.add(parentFolderForFilePath(p));
  }
  for (const p of diff.finalNewPaths) {
    nmFolders.add(parentFolderForFilePath(p));
  }
  return nmFolders.size;
}

export function folderTreeQuickScanResultFromDiff(diff: FolderTreeQuickScanDiff): FolderTreeQuickScanResult {
  const deletedPaths = diff.deletedPaths;

  return {
    ultraFastScanMs: diff.ultraMs,
    normalScanMs: diff.normalMs,
    normalTotalMs: diff.normalTotalMs,
    ultraChangedFolderCount: diff.ultraChangedFolderCount,
    ultraFoldersScanned: diff.ultraFoldersScanned,
    ultraBaselineSeeded: diff.ultraBaselineSeeded,
    treeFoldersWithDirectMediaOnDiskCount: diff.treeFoldersWithDirectMediaOnDiskCount,
    treeFoldersWithMetadataFolderScanCount: diff.treeFoldersWithMetadataFolderScanCount,
    oldestMetadataFolderScanAtAmongWalkedFolders: diff.oldestMetadataFolderScanAtAmongWalkedFolders,
    newFileCount: diff.finalNewPaths.length,
    modifiedFileCount: diff.modifiedPaths.length,
    deletedFileCount: deletedPaths.length,
    movedFileCount: diff.moves.length,
    newOrModifiedFolderCount: newOrModifiedFolderCount(diff),
    movedMatchModeUsed: diff.movedMatchModeUsed,
    deletedSamplePaths: takeSample(deletedPaths, SAMPLE_CAP),
    movedItems: diff.moves,
    newSamplePaths: takeSample(diff.finalNewPaths, SAMPLE_CAP),
    modifiedSamplePaths: takeSample(diff.modifiedPaths, SAMPLE_CAP),
  };
}

export async function runFolderTreeQuickScans(params: {
  rootFolderPath: string;
  libraryId?: string;
  movedMatchMode: QuickScanMovedFileMatchMode;
}): Promise<FolderTreeQuickScanResult> {
  const diff = await computeFolderTreeQuickScanDiff(params);
  return folderTreeQuickScanResultFromDiff(diff);
}

export { computeFolderTreeQuickScanDiff, type FolderTreeQuickScanDiff } from "./folder-tree-quick-scan-compute";
