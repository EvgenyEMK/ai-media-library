import path from "node:path";
import type {
  FolderTreeQuickScanBreakdown,
  FolderTreeQuickScanSubfolderRow,
  FolderTreeQuickScanSubfolderStats,
} from "../../src/shared/ipc";
import type { FolderTreeQuickScanDiff } from "./folder-tree-quick-scan-compute";
import { parentFolderForFilePath } from "./folder-tree-quick-scan-moves";

function isUnderFolder(folderPath: string, absolutePath: string): boolean {
  const f = path.normalize(folderPath.trim());
  const p = path.normalize(absolutePath);
  return p === f || p.startsWith(f + path.sep);
}

function statsForSubtree(childOrSubtreeRoot: string, diff: FolderTreeQuickScanDiff): FolderTreeQuickScanSubfolderStats {
  const scope = path.normalize(childOrSubtreeRoot.trim());

  const newFileCount = diff.finalNewPaths.filter((p) => isUnderFolder(scope, p)).length;
  const modifiedFileCount = diff.modifiedPaths.filter((p) => isUnderFolder(scope, p)).length;
  const deletedFileCount = diff.deletedPaths.filter((p) => isUnderFolder(scope, p)).length;
  const movedFileCount = diff.moves.filter((m) => isUnderFolder(scope, m.newPath)).length;

  const mediaFoldersInScope = diff.pathsWithDirectMedia.filter((fp) => isUnderFolder(scope, fp));
  const foldersWithDirectMediaOnDisk = mediaFoldersInScope.length;
  let foldersWithFolderScanRecord = 0;
  for (const fp of mediaFoldersInScope) {
    if (diff.folderMetadataScannedAtByPath[fp] != null) foldersWithFolderScanRecord += 1;
  }

  return {
    newFileCount,
    modifiedFileCount,
    deletedFileCount,
    movedFileCount,
    foldersWithDirectMediaOnDisk,
    foldersWithFolderScanRecord,
  };
}

function statsDirectFilesInRootOnly(root: string, diff: FolderTreeQuickScanDiff): FolderTreeQuickScanSubfolderStats {
  const rootNorm = path.normalize(root.trim());
  const inRootOnly = (filePath: string): boolean => parentFolderForFilePath(path.normalize(filePath)) === rootNorm;

  const newFileCount = diff.finalNewPaths.filter(inRootOnly).length;
  const modifiedFileCount = diff.modifiedPaths.filter(inRootOnly).length;
  const deletedFileCount = diff.deletedPaths.filter(inRootOnly).length;
  const movedFileCount = diff.moves.filter(
    (m) => inRootOnly(m.newPath) || inRootOnly(m.previousPath),
  ).length;

  const mediaFoldersInScope = diff.pathsWithDirectMedia.filter((fp) => fp === rootNorm);
  const foldersWithDirectMediaOnDisk = mediaFoldersInScope.length;
  let foldersWithFolderScanRecord = 0;
  for (const fp of mediaFoldersInScope) {
    if (diff.folderMetadataScannedAtByPath[fp] != null) foldersWithFolderScanRecord += 1;
  }

  return {
    newFileCount,
    modifiedFileCount,
    deletedFileCount,
    movedFileCount,
    foldersWithDirectMediaOnDisk,
    foldersWithFolderScanRecord,
  };
}

export function buildFolderTreeQuickScanBreakdown(
  rootFolderPath: string,
  directChildren: Array<{ path: string; name: string }>,
  diff: FolderTreeQuickScanDiff,
): FolderTreeQuickScanBreakdown {
  const selectedTree: FolderTreeQuickScanSubfolderStats = {
    newFileCount: diff.finalNewPaths.length,
    modifiedFileCount: diff.modifiedPaths.length,
    deletedFileCount: diff.deletedPaths.length,
    movedFileCount: diff.moves.length,
    foldersWithDirectMediaOnDisk: diff.treeFoldersWithDirectMediaOnDiskCount,
    foldersWithFolderScanRecord: diff.treeFoldersWithMetadataFolderScanCount,
  };

  const selectedDirectOnly = statsDirectFilesInRootOnly(rootFolderPath, diff);

  const subfolders: FolderTreeQuickScanSubfolderRow[] = directChildren.map((node) => ({
    ...statsForSubtree(node.path, diff),
    folderPath: node.path,
    name: node.name,
  }));

  return {
    selectedTree,
    selectedDirectOnly,
    subfolders,
  };
}
