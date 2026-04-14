/**
 * Returns the parent directory of `filePath`, including a trailing path separator
 * when one is present in the original path (e.g. `C:\photos\` or `/home/u/`).
 */
export function parentPathWithTrailingSep(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return "";
  }
  const lastBack = trimmed.lastIndexOf("\\");
  const lastFwd = trimmed.lastIndexOf("/");
  const lastSep = Math.max(lastBack, lastFwd);
  if (lastSep < 0) {
    return "";
  }
  return trimmed.slice(0, lastSep + 1);
}
