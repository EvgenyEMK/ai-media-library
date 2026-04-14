/**
 * Opt-in debug output for path-based date/location extraction (script + LLM).
 * Set `EMK_DEBUG_PATH_EXTRACTION` to `1`, `true`, or `yes`.
 */
export function isPathExtractionDebugEnabled(): boolean {
  const v = process.env.EMK_DEBUG_PATH_EXTRACTION?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Same as `console.log` when {@link isPathExtractionDebugEnabled()} is true; no-op otherwise. */
export function pathExtractionDebugLog(...args: unknown[]): void {
  if (!isPathExtractionDebugEnabled()) return;
  console.log(...args);
}
