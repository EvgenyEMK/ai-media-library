import { parentFolderPath } from "./duplicate-files-folder-scope";
import { comparableFilePath } from "./media-metadata-lookup";

export type PathDisplayStyle = "win" | "posix";

/**
 * Infer how to render paths for the duplicate UI from a representative path (usually scan root).
 */
export function inferPathDisplayStyle(primaryPath: string): PathDisplayStyle {
  const raw = primaryPath.trim();
  if (!raw) {
    return "posix";
  }
  if (/^[A-Za-z]:/.test(comparableFilePath(raw))) {
    return "win";
  }
  if (/\\/.test(raw)) {
    return "win";
  }
  return "posix";
}

/** Render a comparable (slash) path for display using Windows or POSIX separators. */
export function formatComparablePathForDisplay(comparablePath: string, style: PathDisplayStyle): string {
  const c = comparableFilePath(comparablePath);
  if (!c) {
    return "";
  }
  if (style === "win") {
    return c.replace(/\//g, "\\");
  }
  return c;
}

export function splitFileNameAndComparableParent(filePath: string): { fileName: string; parentComparable: string } {
  const c = comparableFilePath(filePath);
  const i = c.lastIndexOf("/");
  if (i <= 0) {
    return { fileName: c || filePath, parentComparable: "" };
  }
  return { fileName: c.slice(i + 1), parentComparable: c.slice(0, i) };
}

function rootPrefixLower(rootComparable: string): string {
  const root = comparableFilePath(rootComparable);
  if (!root) {
    return "";
  }
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return prefix.toLowerCase();
}

function isStrictlyUnderRoot(parentComparable: string, rootComparable: string): boolean {
  const par = comparableFilePath(parentComparable).toLowerCase();
  const root = comparableFilePath(rootComparable).toLowerCase();
  if (!root || !par) {
    return false;
  }
  if (par === root) {
    return false;
  }
  const pre = rootPrefixLower(rootComparable);
  return pre.length > 0 && par.startsWith(pre);
}

/**
 * Second line in the "Selected folder" column: `...\sub` under the scan root, full parent if outside root.
 * Returns empty string when the file sits directly under that root (no extra line).
 */
export function formatSelectedColumnFolderLine(
  scopedFilePath: string,
  scanRootComparable: string,
  style: PathDisplayStyle,
): string {
  const parentNorm = comparableFilePath(parentFolderPath(scopedFilePath));
  const rootNorm = comparableFilePath(scanRootComparable);
  if (!parentNorm) {
    return "";
  }
  if (!rootNorm) {
    return formatComparablePathForDisplay(parentNorm, style);
  }
  if (parentNorm.toLowerCase() === rootNorm.toLowerCase()) {
    return "";
  }
  if (!isStrictlyUnderRoot(parentNorm, rootNorm)) {
    return formatComparablePathForDisplay(parentNorm, style);
  }
  const prefix = rootNorm.endsWith("/") ? rootNorm : `${rootNorm}/`;
  const rel = parentNorm.slice(prefix.length);
  if (!rel) {
    return "";
  }
  const sep = style === "win" ? "\\" : "/";
  const tail = style === "win" ? rel.replace(/\//g, "\\") : rel;
  return `...${sep}${tail}`;
}
