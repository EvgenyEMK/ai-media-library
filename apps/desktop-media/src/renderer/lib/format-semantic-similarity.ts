/** Formats cosine similarity in [0, 1] for display (AI image search list rows). */
export function formatSemanticCosinePercent(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}
