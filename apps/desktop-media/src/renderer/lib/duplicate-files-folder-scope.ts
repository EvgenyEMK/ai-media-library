import { comparableFilePath } from "./media-metadata-lookup";

/**
 * Renderer-safe path helpers — must not use `node:path` (breaks Vite bundle).
 * Mirrors `electron/lib/folder-duplicate-scan-scope.ts` closely enough for UI grouping/filtering.
 */

function dirnameComparable(filePath: string): string {
  const n = comparableFilePath(filePath);
  const i = n.lastIndexOf("/");
  if (i <= 0) {
    return n;
  }
  return n.slice(0, i);
}

/**
 * Whether `filePath` is inside the folder scope (direct files only, or full subtree).
 */
export function isMediaPathInFolderScope(
  filePath: string,
  normalizedRootFolder: string,
  recursive: boolean,
): boolean {
  const normRoot = comparableFilePath(normalizedRootFolder.trim()).toLowerCase();
  const normFile = comparableFilePath(filePath);
  const fileKey = normFile.toLowerCase();

  if (fileKey === normRoot) {
    return false;
  }

  const rootPrefix = comparableFilePath(normalizedRootFolder.trim());
  const rootWithSep = rootPrefix.endsWith("/") ? rootPrefix : `${rootPrefix}/`;
  const rootPrefixLower = rootWithSep.toLowerCase();

  if (recursive) {
    return (
      fileKey.startsWith(rootPrefixLower) ||
      dirnameComparable(filePath).toLowerCase() === normRoot
    );
  }

  return dirnameComparable(filePath).toLowerCase() === normRoot;
}

export function normalizedScanRoot(scanFolderPath: string): string {
  return comparableFilePath(scanFolderPath.trim());
}

export function parentFolderPath(filePath: string): string {
  return dirnameComparable(filePath);
}

/**
 * Whether a catalog file path lies under `selectionFolderPath` on disk (prefix subtree),
 * used to classify duplicate locations vs the folder selected in the tree.
 */
export function isMediaPathInsideSelectionDiskTree(filePath: string, selectionFolderPath: string): boolean {
  const root = normalizedScanRoot(selectionFolderPath);
  if (!root) {
    return false;
  }
  const rootLower = root.toLowerCase();
  const fileKey = comparableFilePath(filePath).toLowerCase();
  if (fileKey === rootLower) {
    return true;
  }
  const rootPrefix = root.endsWith("/") ? root : `${root}/`;
  return fileKey.startsWith(rootPrefix.toLowerCase());
}
