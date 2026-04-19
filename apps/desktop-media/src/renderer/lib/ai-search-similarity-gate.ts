import type { SemanticSearchSignalMode } from "@emk/media-store";

/**
 * Display filter for AI image search.
 *
 * - **hybrid** / **hybrid-max** (default): hide only when both VLM and description are strictly below their floors.
 * - **vlm-only** / **description-only**: use that signal alone (for comparison tests).
 */
export function passesAiImageSearchSimilarityGate(
  item: { vlmSimilarity?: number; descriptionSimilarity?: number },
  vlmThreshold: number,
  descriptionThreshold: number,
  mode: SemanticSearchSignalMode = "hybrid",
): boolean {
  const vlm = item.vlmSimilarity;
  const desc = item.descriptionSimilarity;
  const vlmOk = typeof vlm === "number" && Number.isFinite(vlm) && vlm >= vlmThreshold;
  const descOk =
    typeof desc === "number" && Number.isFinite(desc) && desc >= descriptionThreshold;
  if (mode === "hybrid" || mode === "hybrid-max") {
    return vlmOk || descOk;
  }
  if (mode === "vlm-only") {
    return vlmOk;
  }
  return descOk;
}
