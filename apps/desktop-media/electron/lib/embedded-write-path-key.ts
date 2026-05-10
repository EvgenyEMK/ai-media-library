import fs from "node:fs";
import path from "node:path";

/**
 * Stable Map key for serializing embedded writes to the same file.
 * On Windows the filesystem is case-insensitive but JS string keys are not — use realpath so
 * `C:\a\b.jpg` and `c:\a\b.jpg` share one queue. Falls back to {@link path.normalize} when the path
 * cannot be resolved yet.
 */
export function canonicalPathKeyForEmbeddedWriteQueue(sourcePath: string): string {
  const trimmed = sourcePath.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    return fs.realpathSync.native(trimmed);
  } catch {
    return path.normalize(trimmed);
  }
}
