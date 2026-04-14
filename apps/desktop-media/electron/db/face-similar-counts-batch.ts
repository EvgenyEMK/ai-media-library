import { countSimilarUntaggedFacesForPerson } from "./face-embeddings";

/** Batch for People tab live counts (same definition as findPersonMatches with limit 0). */
export function getSimilarUntaggedFaceCountsForTags(
  tagIds: string[],
  options: { threshold?: number; libraryId?: string } = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  const unique = Array.from(new Set(tagIds.filter(Boolean)));
  for (const tagId of unique) {
    out[tagId] = countSimilarUntaggedFacesForPerson(tagId, options);
  }
  return out;
}
