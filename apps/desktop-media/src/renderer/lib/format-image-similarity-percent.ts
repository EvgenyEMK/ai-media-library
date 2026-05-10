/**
 * Formats cosine similarity in [0, 1] as an integer percent for “Similar images” list rows.
 * Avoids showing 100% when the raw score is below 1 (not identical to the source embedding).
 */
export function formatImageSimilarityPercent(score: number | undefined | null): string {
  if (score == null || Number.isNaN(score)) {
    return "—";
  }
  const clamped = Math.max(0, Math.min(1, score));
  const rounded = Math.round(clamped * 100);
  if (rounded === 100 && clamped < 1) {
    return "99%";
  }
  return `${rounded}%`;
}
