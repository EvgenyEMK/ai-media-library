/**
 * Opt-in renderer logs for path metadata (LLM) flow.
 * Set `VITE_DEBUG_PATH_ANALYSIS` to `1`, `true`, or `yes` in `.env` (Vite exposes only `VITE_*`).
 */
function isPathAnalysisRendererDebugEnabled(): boolean {
  try {
    const raw = (import.meta as unknown as { env?: { VITE_DEBUG_PATH_ANALYSIS?: string } }).env
      ?.VITE_DEBUG_PATH_ANALYSIS;
    const v = String(raw ?? "")
      .trim()
      .toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  } catch {
    return false;
  }
}

export function pathAnalysisRendererDebugLog(...args: unknown[]): void {
  if (!isPathAnalysisRendererDebugEnabled()) return;
  console.log(...args);
}
