/**
 * Unify path separators for stable comparisons (Windows `\` vs `/`, duplicated slashes).
 * Renderer must not import `node:path` — Vite targets browser semantics and it can break the bundle.
 */
export function comparableFilePath(p: string): string {
  if (!p) {
    return "";
  }
  return p
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

/**
 * Resolve catalog metadata for a file path. DB keys use `source_path` from SQLite;
 * renderer item ids come from the same paths but minor differences (slashes, casing on
 * Windows) must still match so quick filters and the viewer see `aiMetadata`.
 */
export function lookupMediaMetadataByItemId<T>(
  itemId: string,
  map: Record<string, unknown>,
): T | undefined {
  if (typeof itemId !== "string" || itemId.length === 0) {
    return undefined;
  }

  const direct = map[itemId];
  if (direct !== undefined && direct !== null) {
    return direct as T;
  }

  const normalizedLookup = comparableFilePath(itemId);
  const byNorm = map[normalizedLookup];
  if (byNorm !== undefined && byNorm !== null) {
    return byNorm as T;
  }

  const targetKey = normalizedLookup.toLowerCase();
  if (targetKey.length === 0) {
    return undefined;
  }

  for (const key of Object.keys(map)) {
    if (comparableFilePath(key).toLowerCase() === targetKey) {
      const v = map[key];
      if (v !== undefined && v !== null) {
        return v as T;
      }
    }
  }

  return undefined;
}
