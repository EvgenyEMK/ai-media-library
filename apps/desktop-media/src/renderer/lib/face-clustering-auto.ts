export const AUTO_FIND_GROUPS_MAX_EMBEDDED_UNTAGGED = 300;

export interface FaceClusteringAutoStats {
  readyUntaggedFaceCount: number;
  ungroupedReadyUntaggedFaceCount: number;
}

export function shouldAutoFindFaceGroups(params: {
  clusterTotalCount: number;
  stats: FaceClusteringAutoStats | null;
  isLoading: boolean;
  isClusteringRunning: boolean;
  alreadyTriggered: boolean;
  maxReadyUntagged?: number;
}): boolean {
  if (params.alreadyTriggered || params.isLoading || params.isClusteringRunning) return false;
  if (params.clusterTotalCount > 0 || !params.stats) return false;
  const maxReadyUntagged =
    params.maxReadyUntagged ?? AUTO_FIND_GROUPS_MAX_EMBEDDED_UNTAGGED;
  return (
    params.stats.readyUntaggedFaceCount > 0 &&
    params.stats.readyUntaggedFaceCount <= maxReadyUntagged &&
    params.stats.ungroupedReadyUntaggedFaceCount > 0
  );
}
