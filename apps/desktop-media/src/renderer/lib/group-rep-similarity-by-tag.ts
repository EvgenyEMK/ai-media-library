/**
 * Groups cluster representatives by person tag for batched
 * `getFaceToPersonCentroidSimilarities(faceIds, tagId)` calls.
 *
 * Without batching, one IPC per cluster serializes and can take minutes at scale.
 */

export type RepSimilarityItem = { clusterId: string; repId: string };

export function groupRepresentativeFaceIdsByTag(
  clusters: Array<{
    clusterId: string;
    representativeFace: { faceInstanceId: string } | null | undefined;
  }>,
  getTagForCluster: (clusterId: string) => string | undefined,
): Map<string, RepSimilarityItem[]> {
  const byTag = new Map<string, RepSimilarityItem[]>();
  for (const c of clusters) {
    const tagId = getTagForCluster(c.clusterId);
    const repId = c.representativeFace?.faceInstanceId;
    if (!tagId || !repId) continue;
    const list = byTag.get(tagId) ?? [];
    list.push({ clusterId: c.clusterId, repId });
    byTag.set(tagId, list);
  }
  return byTag;
}
