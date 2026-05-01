import type { ImageEditSuggestion, PreviewTransform, PriorityLevel } from "./image-edit-suggestions-types";

export function getPriorityLevel(priority: unknown): PriorityLevel {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "unknown";
}

export function getPriorityRank(priority: PriorityLevel): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  if (priority === "low") return 2;
  return 3;
}

export function computeTransform(suggestions: ImageEditSuggestion[]): PreviewTransform {
  let rotationAngle: 90 | 180 | 270 | null = null;
  let cropBox: { x: number; y: number; width: number; height: number } | null = null;
  const previewSuggestionIndexes = new Set<number>();

  suggestions.forEach((suggestion, index) => {
    if (
      rotationAngle === null &&
      (suggestion.rotationAngleClockwise === 90 ||
        suggestion.rotationAngleClockwise === 180 ||
        suggestion.rotationAngleClockwise === 270)
    ) {
      rotationAngle = suggestion.rotationAngleClockwise;
      previewSuggestionIndexes.add(index);
    }

    const cropRel = suggestion.cropRel;
    if (
      cropBox === null &&
      cropRel &&
      Number.isFinite(cropRel.x) &&
      Number.isFinite(cropRel.y) &&
      Number.isFinite(cropRel.width) &&
      Number.isFinite(cropRel.height)
    ) {
      cropBox = cropRel;
      previewSuggestionIndexes.add(index);
    }
  });

  return { rotationAngle, cropBox, previewSuggestionIndexes };
}
