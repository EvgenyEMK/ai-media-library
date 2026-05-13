import path from "node:path";

/** SQLite LIKE escape — matches `folder-tree-quick-scan-compute`. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

/** Prefix patterns for catalog paths under `rootPath`. */
export function scopeLikePatterns(rootPath: string): { exact: string; like: string } {
  const normalized = path.normalize(rootPath.trim());
  const sep = normalized.includes("\\") ? "\\" : "/";
  const withSep = normalized.endsWith(sep) ? normalized : `${normalized}${sep}`;
  return {
    exact: normalized,
    like: `${escapeLikePattern(withSep)}%`,
  };
}

export function pathModuleForSourcePath(samplePath: string): typeof path.win32 | typeof path.posix {
  return samplePath.includes("\\") ? path.win32 : path.posix;
}

/**
 * Whether `filePath` is inside the folder scope (direct files only, or full subtree).
 */
export function isMediaPathInFolderScope(
  filePath: string,
  normalizedRootFolder: string,
  recursive: boolean,
): boolean {
  const pm = pathModuleForSourcePath(filePath);
  const normRoot = pm.normalize(normalizedRootFolder.trim());
  const normFile = pm.normalize(filePath);
  if (normFile === normRoot) {
    return false;
  }
  const rootWithSep = normRoot.endsWith(pm.sep) ? normRoot : `${normRoot}${pm.sep}`;
  if (recursive) {
    return normFile.startsWith(rootWithSep) || pm.dirname(normFile) === normRoot;
  }
  return pm.dirname(normFile) === normRoot;
}
