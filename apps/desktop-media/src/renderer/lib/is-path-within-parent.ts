/**
 * True if `targetPath` equals `parentPath` or lies under it (filesystem path prefix).
 * Normalizes slashes and compares case-insensitively (Windows-friendly).
 */
export function isPathWithinParent(targetPath: string, parentPath: string): boolean {
  if (targetPath === parentPath) return true;
  const normalizedTarget = targetPath.replace(/[\\/]+/g, "/").toLowerCase();
  const normalizedParent = parentPath.replace(/[\\/]+/g, "/").toLowerCase().replace(/\/+$/, "");
  return normalizedTarget.startsWith(`${normalizedParent}/`);
}
