import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { PeopleWorkspaceOpenFacePhotoFn } from "@emk/media-viewer";
import type {
  ClusterPersonCentroidMatchStats,
  DesktopPersonTag,
  FaceClusterFaceInfo,
  FaceClusterInfo,
  FaceClusterTagSuggestion,
} from "../../shared/ipc";
import { PeoplePaginationBar } from "./people-pagination-bar";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import { Input } from "./ui/input";
import { FaceSelectionFooter } from "./FaceSelectionFooter";
import { FaceThumbWithPreview } from "./FaceThumbWithPreview";
import { chunkArray } from "./face-cluster-utils";
import { groupRepresentativeFaceIdsByTag } from "../lib/group-rep-similarity-by-tag";
import { logUntaggedLoadRenderer } from "../lib/untagged-load-log";
import { untaggedTabLog } from "../lib/untagged-tab-trace";

const CLUSTER_LIST_PAGE_SIZE = 10;
const CLUSTER_FACE_GRID_COLS = 5;
const CLUSTER_FACE_ROWS_PER_PAGE = 5;
const CLUSTER_MEMBER_PAGE_SIZE = CLUSTER_FACE_GRID_COLS * CLUSTER_FACE_ROWS_PER_PAGE;
const SIM_BATCH = 80;
/** Batched IPC size for representative × person-centroid cosine (many clusters share one tag). */
const REP_SIM_IPC_CHUNK = 250;

function formatSimilarityPercent(similarity01: number): string {
  const p = Math.round(similarity01 * 1000) / 10;
  if (Number.isInteger(p)) {
    return String(Math.round(p));
  }
  return p.toFixed(1);
}

function sortFaceIdsBySimilarityDesc(
  faceIds: string[],
  similarities: Record<string, number>,
): string[] {
  return [...faceIds].sort((a, b) => {
    const sa = similarities[a] ?? -1;
    const sb = similarities[b] ?? -1;
    if (sb !== sa) {
      return sb - sa;
    }
    return a.localeCompare(b);
  });
}

const UI_TEXT = {
  title: "Untagged faces",
  description:
    "Auto-grouped faces that haven't been assigned a person tag yet. Name a group to assign all its faces at once.",
  runClustering: "Find groups",
  refresh: "Refresh",
  empty: "No face clusters found. Run face detection with embeddings first, then click \"Find groups\".",
  members: "faces",
  nameGroup: "Name this person",
  assigning: "Assigning...",
  createAndAssign: "Create & assign",
  suggestedMatch: "Suggested match",
  showLabel: "Show:",
  filterAll: "All",
  filterEmpty:
    "No faces match this filter for the selected person. Try “All” or pick another person.",
} as const;

type MemberShowFilter = "all" | "matching" | "mid" | "below";

function personFilteredMemberCacheKey(
  clusterId: string,
  tagId: string,
  mode: "matching" | "mid" | "below",
  threshold: number,
): string {
  return `${clusterId}\0${tagId}\0${mode}\0${String(threshold)}`;
}

interface ExpandedCluster {
  clusterId: string;
  faceInfos: Record<string, FaceClusterFaceInfo | null>;
}

async function fetchFaceInfosBatched(
  faceIds: string[],
): Promise<Record<string, FaceClusterFaceInfo | null>> {
  const out: Record<string, FaceClusterFaceInfo | null> = {};
  for (const chunk of chunkArray(faceIds, 100)) {
    const part = await window.desktopApi.getFaceInfoByIds(chunk);
    Object.assign(out, part);
  }
  return out;
}

async function fetchSimilaritiesBatched(
  faceIds: string[],
  tagId: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const chunk of chunkArray(faceIds, SIM_BATCH)) {
    const part = await window.desktopApi.getFaceToPersonCentroidSimilarities(chunk, tagId);
    Object.assign(out, part);
  }
  return out;
}

export function DesktopFaceClusterGrid({
  onOpenFacePhoto,
}: {
  onOpenFacePhoto: PeopleWorkspaceOpenFacePhotoFn;
}): ReactElement {
  const store = useDesktopStoreApi();
  const faceClusteringStatus = useDesktopStore((s) => s.faceClusteringStatus);
  const matchThreshold = useDesktopStore(
    (s) => s.faceDetectionSettings.faceRecognitionSimilarityThreshold,
  );
  const faceGroupPairwiseSimilarityThreshold = useDesktopStore(
    (s) => s.faceDetectionSettings.faceGroupPairwiseSimilarityThreshold,
  );
  const faceGroupMinSize = useDesktopStore((s) => s.faceDetectionSettings.faceGroupMinSize);

  const [clusters, setClusters] = useState<FaceClusterInfo[]>([]);
  const [clusterListPage, setClusterListPage] = useState(0);
  const [clusterTotalCount, setClusterTotalCount] = useState(0);
  const [clusterSuggestions, setClusterSuggestions] = useState<
    Record<string, FaceClusterTagSuggestion | null>
  >({});
  const [targetTagByCluster, setTargetTagByCluster] = useState<Record<string, string>>({});
  const [declinedFaceIdsByCluster, setDeclinedFaceIdsByCluster] = useState<Record<string, string[]>>({});
  const [assigningFaceIds, setAssigningFaceIds] = useState<string[]>([]);
  const [pendingAcceptRow, setPendingAcceptRow] = useState<{
    clusterId: string;
    rowIndex: number;
  } | null>(null);
  const [personTags, setPersonTags] = useState<DesktopPersonTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<ExpandedCluster | null>(null);
  const [clusterSimilarityByClusterId, setClusterSimilarityByClusterId] = useState<
    Record<string, Record<string, number>>
  >({});
  const [clusterMemberPageById, setClusterMemberPageById] = useState<Record<string, number>>({});
  const [loadedFaceIdsByClusterId, setLoadedFaceIdsByClusterId] = useState<Record<string, string[]>>(
    {},
  );
  const [assigningClusterId, setAssigningClusterId] = useState<string | null>(null);
  const [namingClusterId, setNamingClusterId] = useState<string | null>(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [clusterPersonMatchStats, setClusterPersonMatchStats] = useState<
    Record<string, ClusterPersonCentroidMatchStats>
  >({});
  const [memberFilterByClusterId, setMemberFilterByClusterId] = useState<
    Record<string, MemberShowFilter>
  >({});
  const [personFilteredMemberIdsByKey, setPersonFilteredMemberIdsByKey] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    untaggedTabLog("DesktopFaceClusterGrid mounted");
    return () => {
      untaggedTabLog("DesktopFaceClusterGrid unmounting");
    };
  }, []);

  const loadClusters = useCallback(async (explicitListPage?: number) => {
    const listPage = explicitListPage !== undefined ? explicitListPage : clusterListPage;
    const loadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    untaggedTabLog("loadClusters START", { loadId, listPage });
    setIsLoading(true);
    setErrorMessage(null);
    const tLoadStart = performance.now();
    try {
      const tList = performance.now();
      const offset = listPage * CLUSTER_LIST_PAGE_SIZE;
      const [pageResult, tags] = await Promise.all([
        window.desktopApi.getFaceClusters({ offset, limit: CLUSTER_LIST_PAGE_SIZE }),
        window.desktopApi.listPersonTags(),
      ]);
      const clusterData = pageResult.clusters;
      const msList = performance.now() - tList;
      untaggedTabLog("loadClusters after getFaceClusters+listPersonTags", {
        loadId,
        ms: Math.round(msList * 100) / 100,
        clusterCount: clusterData.length,
        totalCount: pageResult.totalCount,
        personTagCount: tags.length,
      });
      logUntaggedLoadRenderer("ipc.getFaceClusters+listPersonTags", msList, {
        clusterCount: clusterData.length,
        personTagCount: tags.length,
      });
      setClusters(clusterData);
      setClusterTotalCount(pageResult.totalCount);
      setPersonTags(tags);
      setLoadedFaceIdsByClusterId({});
      setClusterMemberPageById({});
      setPersonFilteredMemberIdsByKey({});
      setExpandedCluster(null);
      if (clusterData.length === 0) {
        setClusterSuggestions({});
      } else {
        const ids = clusterData.map((c) => c.clusterId);
        const tSuggest = performance.now();
        const batch = await window.desktopApi.suggestPersonTagsForClusters(ids);
        const msSuggest = performance.now() - tSuggest;
        untaggedTabLog("loadClusters after suggestPersonTagsForClusters", {
          loadId,
          ms: Math.round(msSuggest * 100) / 100,
          clusterCount: ids.length,
        });
        logUntaggedLoadRenderer("ipc.suggestPersonTagsForClusters", msSuggest, {
          clusterCount: ids.length,
        });
        setClusterSuggestions(batch);
        setTargetTagByCluster((current) => {
          const next = { ...current };
          for (const cluster of clusterData) {
            const suggestion = batch[cluster.clusterId];
            if (!next[cluster.clusterId] && suggestion?.tagId) {
              next[cluster.clusterId] = suggestion.tagId;
            }
          }
          return next;
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load clusters.";
      untaggedTabLog("loadClusters ERROR", { loadId, message: msg });
      setErrorMessage(msg);
    } finally {
      untaggedTabLog("loadClusters FINALLY (isLoading=false)", {
        loadId,
        totalMs: Math.round((performance.now() - tLoadStart) * 100) / 100,
      });
      setIsLoading(false);
    }
  }, [clusterListPage]);

  useEffect(() => {
    untaggedTabLog("effect: schedule loadClusters() on mount / clusterListPage change");
    void loadClusters();
  }, [loadClusters]);

  useEffect(() => {
    if (faceClusteringStatus === "completed") {
      untaggedTabLog("faceClusteringStatus completed → reload clusters");
      setClusterListPage(0);
      void loadClusters(0);
    }
  }, [faceClusteringStatus, loadClusters]);

  /** Representative-only similarity for collapsed rows — batched by tag to avoid thousands of serial IPC calls. */
  useEffect(() => {
    if (clusters.length === 0) {
      untaggedTabLog("repSimilarity effect: skip (no clusters)");
      setClusterSimilarityByClusterId({});
      return;
    }

    const effectId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    untaggedTabLog("repSimilarity effect START", {
      effectId,
      clusterCount: clusters.length,
      suggestionKeys: Object.keys(clusterSuggestions).length,
      targetTagKeys: Object.keys(targetTagByCluster).length,
    });

    let cancelled = false;
    void (async () => {
      const t0 = performance.now();
      const getTag = (clusterId: string) =>
        targetTagByCluster[clusterId] || clusterSuggestions[clusterId]?.tagId;

      const byTag = groupRepresentativeFaceIdsByTag(clusters, getTag);
      const next: Record<string, Record<string, number>> = {};
      for (const c of clusters) {
        next[c.clusterId] = {};
      }

      let ipcCalls = 0;
      for (const [tagId, items] of byTag) {
        const slices = chunkArray(items, REP_SIM_IPC_CHUNK);
        for (const slice of slices) {
          if (cancelled) return;
          const repIds = slice.map((s) => s.repId);
          try {
            const sims = await window.desktopApi.getFaceToPersonCentroidSimilarities(repIds, tagId);
            ipcCalls += 1;
            for (const { clusterId, repId } of slice) {
              const score = sims[repId];
              if (score !== undefined) {
                next[clusterId][repId] = score;
              }
            }
          } catch {
            for (const { clusterId } of slice) {
              next[clusterId] = next[clusterId] ?? {};
            }
          }
        }
      }

      const msRep = performance.now() - t0;
      untaggedTabLog("repSimilarity effect DONE", {
        effectId,
        ms: Math.round(msRep * 100) / 100,
        distinctTags: byTag.size,
        ipcCalls,
        cancelled,
      });
      logUntaggedLoadRenderer("repCentroidSimilarity.batched", msRep, {
        clusterCount: clusters.length,
        distinctTags: byTag.size,
        ipcCalls,
      });

      if (!cancelled) {
        setClusterSimilarityByClusterId((prev) => {
          const merged: Record<string, Record<string, number>> = { ...prev };
          for (const c of clusters) {
            merged[c.clusterId] = {
              ...(merged[c.clusterId] ?? {}),
              ...(next[c.clusterId] ?? {}),
            };
          }
          return merged;
        });
      }
    })();

    return () => {
      cancelled = true;
      untaggedTabLog("repSimilarity effect CLEANUP (cancel async work)", { effectId });
    };
  }, [clusters, clusterSuggestions, targetTagByCluster]);

  /** Same centroid + threshold as People / Tagged; per-cluster subset vs library-wide total. */
  useEffect(() => {
    if (clusters.length === 0) {
      setClusterPersonMatchStats({});
      return;
    }

    const items = clusters
      .map((c) => ({
        clusterId: c.clusterId,
        tagId:
          targetTagByCluster[c.clusterId] || clusterSuggestions[c.clusterId]?.tagId || "",
      }))
      .filter((i) => i.tagId.length > 0);

    if (items.length === 0) {
      setClusterPersonMatchStats({});
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const stats = await window.desktopApi.getClusterPersonMatchStatsBatch(
          items,
          matchThreshold,
        );
        if (!cancelled) {
          setClusterPersonMatchStats(stats);
        }
      } catch {
        if (!cancelled) {
          setClusterPersonMatchStats({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clusters, targetTagByCluster, clusterSuggestions, matchThreshold]);

  /** Load full matching / other-similar ID lists for expanded cluster (server-side, same metric as stats). */
  useEffect(() => {
    if (!expandedCluster) return;
    const clusterId = expandedCluster.clusterId;
    const memberFilter = memberFilterByClusterId[clusterId] ?? "all";
    const tagId = targetTagByCluster[clusterId] ?? "";
    if (memberFilter === "all" || !tagId) return;

    const key = personFilteredMemberCacheKey(
      clusterId,
      tagId,
      memberFilter,
      matchThreshold,
    );
    if (Object.prototype.hasOwnProperty.call(personFilteredMemberIdsByKey, key)) return;

    let cancelled = false;
    void (async () => {
      try {
        const ids = await window.desktopApi.getClusterMemberFaceIdsForPersonSimilarityFilter(
          clusterId,
          tagId,
          memberFilter,
          matchThreshold,
        );
        if (cancelled) return;
        setPersonFilteredMemberIdsByKey((prev) => ({ ...prev, [key]: ids }));
      } catch {
        if (cancelled) return;
        setPersonFilteredMemberIdsByKey((prev) => ({ ...prev, [key]: [] }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    expandedCluster?.clusterId,
    memberFilterByClusterId,
    targetTagByCluster,
    matchThreshold,
    personFilteredMemberIdsByKey,
  ]);

  /** When expanded with matching/other filter, load face metadata for the current page slice. */
  useEffect(() => {
    if (!expandedCluster) return;
    const clusterId = expandedCluster.clusterId;
    const memberFilter = memberFilterByClusterId[clusterId] ?? "all";
    const tagId = targetTagByCluster[clusterId] ?? "";
    if (memberFilter === "all" || !tagId) return;

    const key = personFilteredMemberCacheKey(
      clusterId,
      tagId,
      memberFilter,
      matchThreshold,
    );
    if (!Object.prototype.hasOwnProperty.call(personFilteredMemberIdsByKey, key)) return;

    const allFiltered = personFilteredMemberIdsByKey[key];
    const page = clusterMemberPageById[clusterId] ?? 0;
    const faceIds = allFiltered.slice(
      page * CLUSTER_MEMBER_PAGE_SIZE,
      page * CLUSTER_MEMBER_PAGE_SIZE + CLUSTER_MEMBER_PAGE_SIZE,
    );

    let cancelled = false;
    void (async () => {
      const faceInfos = await fetchFaceInfosBatched(faceIds);
      if (cancelled) return;
      setExpandedCluster((prev) =>
        prev?.clusterId === clusterId ? { clusterId, faceInfos } : prev,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    expandedCluster?.clusterId,
    memberFilterByClusterId,
    targetTagByCluster,
    personFilteredMemberIdsByKey,
    clusterMemberPageById,
    matchThreshold,
  ]);

  /** When a cluster is expanded, load per-face similarity for visible member IDs only. */
  useEffect(() => {
    if (!expandedCluster) return;
    const cluster = clusters.find((c) => c.clusterId === expandedCluster.clusterId);
    if (!cluster) return;
    const clusterId = expandedCluster.clusterId;
    const tagId =
      targetTagByCluster[clusterId] || clusterSuggestions[clusterId]?.tagId;
    if (!tagId) return;

    const memberFilter = memberFilterByClusterId[clusterId] ?? "all";
    let faceIds: string[];
    if (memberFilter === "all") {
      faceIds = loadedFaceIdsByClusterId[clusterId] ?? [];
    } else {
      const key = personFilteredMemberCacheKey(
        clusterId,
        tagId,
        memberFilter,
        matchThreshold,
      );
      if (!Object.prototype.hasOwnProperty.call(personFilteredMemberIdsByKey, key)) return;
      const allFiltered = personFilteredMemberIdsByKey[key];
      const page = clusterMemberPageById[clusterId] ?? 0;
      faceIds = allFiltered.slice(
        page * CLUSTER_MEMBER_PAGE_SIZE,
        page * CLUSTER_MEMBER_PAGE_SIZE + CLUSTER_MEMBER_PAGE_SIZE,
      );
    }

    if (faceIds.length === 0) return;

    const expandId = clusterId;
    untaggedTabLog("expandedMemberSimilarity effect START", {
      clusterId: expandId,
      faceCount: faceIds.length,
    });

    let cancelled = false;
    void (async () => {
      const t0 = performance.now();
      try {
        const sims = await fetchSimilaritiesBatched(faceIds, tagId);
        if (cancelled) return;
        untaggedTabLog("expandedMemberSimilarity effect DONE", {
          clusterId: expandId,
          ms: Math.round((performance.now() - t0) * 100) / 100,
          scoreKeys: Object.keys(sims).length,
        });
        setClusterSimilarityByClusterId((prev) => ({
          ...prev,
          [clusterId]: { ...(prev[clusterId] ?? {}), ...sims },
        }));
      } catch {
        untaggedTabLog("expandedMemberSimilarity effect ERROR", { clusterId: expandId });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    expandedCluster?.clusterId,
    clusters,
    loadedFaceIdsByClusterId,
    targetTagByCluster,
    clusterSuggestions,
    memberFilterByClusterId,
    personFilteredMemberIdsByKey,
    clusterMemberPageById,
    matchThreshold,
  ]);

  const handleRunClustering = async () => {
    setErrorMessage(null);
    // Show immediate feedback in the dock and button before IPC/main work starts.
    store.setState((s) => {
      s.faceClusteringPanelVisible = true;
      s.faceClusteringStatus = "running";
      s.faceClusteringPhase = "loading";
      s.faceClusteringProcessed = 0;
      s.faceClusteringTotal = Math.max(1, s.faceClusteringTotal);
      s.faceClusteringClusterCount = null;
      s.faceClusteringError = null;
    });
    try {
      await window.desktopApi.runFaceClustering({
        similarityThreshold: faceGroupPairwiseSimilarityThreshold,
        minClusterSize: faceGroupMinSize,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clustering failed.";
      setErrorMessage(message);
      store.setState((s) => {
        s.faceClusteringStatus = "failed";
        s.faceClusteringPhase = null;
        s.faceClusteringError = message;
      });
    }
  };

  const loadClusterMemberPage = useCallback(async (cluster: FaceClusterInfo, memberPage: number) => {
    const offset = memberPage * CLUSTER_MEMBER_PAGE_SIZE;
    try {
      const faceIds = await window.desktopApi.listClusterFaceIds(cluster.clusterId, {
        offset,
        limit: CLUSTER_MEMBER_PAGE_SIZE,
      });
      setLoadedFaceIdsByClusterId((prev) => ({ ...prev, [cluster.clusterId]: faceIds }));
      setClusterMemberPageById((prev) => ({ ...prev, [cluster.clusterId]: memberPage }));
      const faceInfos = await fetchFaceInfosBatched(faceIds);
      setExpandedCluster({ clusterId: cluster.clusterId, faceInfos });
    } catch {
      setExpandedCluster({ clusterId: cluster.clusterId, faceInfos: {} });
    }
  }, []);

  const handleExpandCluster = async (cluster: FaceClusterInfo) => {
    if (expandedCluster?.clusterId === cluster.clusterId) {
      setExpandedCluster(null);
      return;
    }
    const memberFilter = memberFilterByClusterId[cluster.clusterId] ?? "all";
    const tagId = targetTagByCluster[cluster.clusterId] ?? "";
    if (memberFilter !== "all" && tagId) {
      setExpandedCluster({ clusterId: cluster.clusterId, faceInfos: {} });
      return;
    }
    await loadClusterMemberPage(cluster, clusterMemberPageById[cluster.clusterId] ?? 0);
  };

  const removeAssignedFacesFromCluster = useCallback(
    (clusterId: string, assignedFaceIds: string[]) => {
      if (assignedFaceIds.length === 0) return;
      setClusters((current) =>
        current
          .map((cluster) => {
            if (cluster.clusterId !== clusterId) return cluster;
            const nextCount = Math.max(0, cluster.memberCount - assignedFaceIds.length);
            return {
              ...cluster,
              memberCount: nextCount,
              representativeFace: nextCount > 0 ? cluster.representativeFace : null,
            };
          })
          .filter((cluster) => cluster.memberCount > 0),
      );

      setLoadedFaceIdsByClusterId((prev) => {
        const ids = prev[clusterId];
        if (!ids) return prev;
        const nextIds = ids.filter((id) => !assignedFaceIds.includes(id));
        return { ...prev, [clusterId]: nextIds };
      });

      setDeclinedFaceIdsByCluster((current) => {
        const next = { ...current };
        if (next[clusterId]) {
          next[clusterId] = next[clusterId].filter((faceId) => !assignedFaceIds.includes(faceId));
        }
        return next;
      });

      const assignedSet = new Set(assignedFaceIds);
      const prefix = `${clusterId}\0`;
      setPersonFilteredMemberIdsByKey((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (!k.startsWith(prefix)) continue;
          const filtered = next[k].filter((id) => !assignedSet.has(id));
          if (filtered.length !== next[k].length) {
            next[k] = filtered;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      if (expandedCluster?.clusterId === clusterId) {
        setExpandedCluster((current) => {
          if (!current || current.clusterId !== clusterId) return current;
          const nextFaceInfos = { ...current.faceInfos };
          assignedFaceIds.forEach((faceId) => {
            delete nextFaceInfos[faceId];
          });
          return { ...current, faceInfos: nextFaceInfos };
        });
      }
    },
    [expandedCluster?.clusterId],
  );

  const handleAssignSpecificFaces = useCallback(
    async (clusterId: string, rowIndex: number, faceIds: string[]) => {
      const targetTagId = targetTagByCluster[clusterId];
      if (!targetTagId) {
        setErrorMessage("Select or create a person tag before accepting faces.");
        return;
      }
      const uniqueFaceIds = Array.from(new Set(faceIds));
      if (uniqueFaceIds.length === 0) return;

      setPendingAcceptRow({ clusterId, rowIndex });
      setAssigningFaceIds((current) => Array.from(new Set([...current, ...uniqueFaceIds])));
      setErrorMessage(null);
      try {
        const { assignedCount } = await window.desktopApi.assignPersonTagsToFaces(
          uniqueFaceIds,
          targetTagId,
        );
        if (assignedCount > 0) {
          removeAssignedFacesFromCluster(clusterId, uniqueFaceIds);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to assign faces.");
      } finally {
        setPendingAcceptRow(null);
        setAssigningFaceIds((current) =>
          current.filter((faceId) => !uniqueFaceIds.includes(faceId)),
        );
      }
    },
    [removeAssignedFacesFromCluster, targetTagByCluster],
  );

  const handleStartNaming = (clusterId: string) => {
    setNamingClusterId(clusterId);
    setNewTagLabel("");
  };

  const handleCreateAndAssign = async (clusterId: string) => {
    const label = newTagLabel.trim();
    if (!label) return;

    setAssigningClusterId(clusterId);
    setErrorMessage(null);
    try {
      const newTag = await window.desktopApi.createPersonTag(label);
      setPersonTags((prev) =>
        [...prev, newTag].sort((a, b) => a.label.localeCompare(b.label)),
      );
      setTargetTagByCluster((current) => ({ ...current, [clusterId]: newTag.id }));
      setNamingClusterId(null);
      setNewTagLabel("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create tag and assign.");
    } finally {
      setAssigningClusterId(null);
    }
  };

  const isExpanded = (clusterId: string) =>
    expandedCluster?.clusterId === clusterId;
  const assigningFaceSet = useMemo(() => new Set(assigningFaceIds), [assigningFaceIds]);

  const isClusteringRunning = faceClusteringStatus === "running";

  const similarityHighPctLabel = formatSimilarityPercent(matchThreshold);
  const similarityLowBand = Math.max(0, matchThreshold - 0.1);
  const similarityLowPctLabel = formatSimilarityPercent(similarityLowBand);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold md:text-4xl">{UI_TEXT.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
            {UI_TEXT.description}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleRunClustering()}
            disabled={isClusteringRunning || isLoading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary/10 px-3 text-sm text-primary"
          >
            {isClusteringRunning ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Grouping...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                {UI_TEXT.runClustering}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setClusterListPage(0);
              void loadClusters(0);
            }}
            disabled={isLoading || isClusteringRunning}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm"
          >
            {isLoading ? "Loading..." : UI_TEXT.refresh}
          </button>
        </div>
      </header>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {clusters.length === 0 && !isLoading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <Users className="mx-auto mb-3 size-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{UI_TEXT.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster) => {
            const expanded = isExpanded(cluster.clusterId);
            const isAssigning = assigningClusterId === cluster.clusterId;
            const isNaming = namingClusterId === cluster.clusterId;
            const suggestion = clusterSuggestions[cluster.clusterId] ?? null;
            const selectedTargetTagId = targetTagByCluster[cluster.clusterId] ?? "";
            const declinedFaceIds = declinedFaceIdsByCluster[cluster.clusterId] ?? [];
            const declinedFaceSet = new Set(declinedFaceIds);
            const representativeFace = cluster.representativeFace;
            const clusterSimilarities = clusterSimilarityByClusterId[cluster.clusterId] ?? {};
            const repSimilarityPercent =
              representativeFace && clusterSimilarities[representativeFace.faceInstanceId] !== undefined
                ? `${(clusterSimilarities[representativeFace.faceInstanceId] * 100).toFixed(1)}%`
                : null;

            const loadedFaceIds = loadedFaceIdsByClusterId[cluster.clusterId] ?? [];
            const memberPage = clusterMemberPageById[cluster.clusterId] ?? 0;
            const memberFilter = memberFilterByClusterId[cluster.clusterId] ?? "all";
            const filterUsesPersonCache =
              Boolean(selectedTargetTagId) &&
              (memberFilter === "matching" || memberFilter === "mid" || memberFilter === "below");
            const filterCacheKey = filterUsesPersonCache
              ? personFilteredMemberCacheKey(
                  cluster.clusterId,
                  selectedTargetTagId,
                  memberFilter,
                  matchThreshold,
                )
              : null;
            const hasFilteredList =
              filterCacheKey !== null &&
              Object.prototype.hasOwnProperty.call(
                personFilteredMemberIdsByKey,
                filterCacheKey,
              );
            const filteredFullIds =
              filterCacheKey && hasFilteredList
                ? personFilteredMemberIdsByKey[filterCacheKey]
                : null;
            const rawDisplayFaceIds =
              filterCacheKey === null
                ? loadedFaceIds
                : filteredFullIds === null
                  ? []
                  : filteredFullIds.slice(
                      memberPage * CLUSTER_MEMBER_PAGE_SIZE,
                      memberPage * CLUSTER_MEMBER_PAGE_SIZE + CLUSTER_MEMBER_PAGE_SIZE,
                    );
            const displayFaceIds =
              filterCacheKey === null && selectedTargetTagId
                ? sortFaceIdsBySimilarityDesc(rawDisplayFaceIds, clusterSimilarities)
                : rawDisplayFaceIds;
            const centroidStats = clusterPersonMatchStats[cluster.clusterId];
            let memberPaginationTotal = cluster.memberCount;
            if (filterCacheKey && centroidStats) {
              memberPaginationTotal = hasFilteredList
                ? filteredFullIds!.length
                : memberFilter === "matching"
                  ? centroidStats.matchingCount
                  : memberFilter === "mid"
                    ? centroidStats.midBandCount
                    : centroidStats.belowMidCount;
            }

            return (
              <div
                key={cluster.clusterId}
                className="rounded-xl border border-border bg-card shadow-sm"
              >
                <div
                  className="flex cursor-pointer items-center gap-4 p-4"
                  onClick={() => void handleExpandCluster(cluster)}
                >
                  {representativeFace ? (
                    <div className="shrink-0">
                      <FaceThumbWithPreview
                        faceInfo={representativeFace}
                        sizeClassName="size-32"
                        onOpenPhoto={() =>
                          onOpenFacePhoto({
                            sourcePath: representativeFace.sourcePath,
                            imageWidth: representativeFace.imageWidth,
                            imageHeight: representativeFace.imageHeight,
                            mediaItemId: null,
                          })
                        }
                      />
                      {repSimilarityPercent ? (
                        <div className="mt-1 w-32 text-center text-[11px] text-muted-foreground">
                          {repSimilarityPercent}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex size-32 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Users className="size-8 text-muted-foreground/60" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {expanded ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      {(() => {
                        const assignLabel =
                          selectedTargetTagId &&
                          personTags.find((t) => t.id === selectedTargetTagId)?.label;
                        const stats = selectedTargetTagId
                          ? clusterPersonMatchStats[cluster.clusterId]
                          : undefined;
                        if (selectedTargetTagId && assignLabel && stats) {
                          return (
                            <span className="font-medium">
                              {cluster.memberCount} faces. {stats.matchingCount} match {assignLabel}
                            </span>
                          );
                        }
                        return (
                          <span className="font-medium">
                            {cluster.memberCount} {UI_TEXT.members}
                          </span>
                        );
                      })()}
                    </div>
                    {suggestion ? (
                      <div className="text-xs text-muted-foreground">
                        {UI_TEXT.suggestedMatch}: {suggestion.tagLabel} (
                        {!selectedTargetTagId || selectedTargetTagId === suggestion.tagId
                          ? repSimilarityPercent ??
                            `${(suggestion.score * 100).toFixed(1)}%`
                          : `${(suggestion.score * 100).toFixed(1)}%`}
                        )
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isNaming ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newTagLabel}
                          onChange={(event) => setNewTagLabel(event.target.value)}
                          placeholder="Person name..."
                          className="h-8 w-40"
                          autoFocus
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void handleCreateAndAssign(cluster.clusterId);
                            }
                            if (event.key === "Escape") {
                              setNamingClusterId(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleCreateAndAssign(cluster.clusterId)}
                          disabled={isAssigning || !newTagLabel.trim()}
                          className="inline-flex h-8 items-center rounded-md border border-primary bg-primary/10 px-3 text-xs text-primary disabled:opacity-50"
                        >
                          {isAssigning ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            UI_TEXT.createAndAssign
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNamingClusterId(null)}
                          className="inline-flex h-8 items-center rounded-md border border-border px-2 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {personTags.length > 0 ? (
                          <select
                            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                            value={selectedTargetTagId}
                            disabled={isAssigning}
                            onChange={(event) => {
                              const tagId = event.target.value;
                              setTargetTagByCluster((current) => ({
                                ...current,
                                [cluster.clusterId]: tagId,
                              }));
                            }}
                          >
                            <option value="">Assign to...</option>
                            {personTags.map((tag) => (
                              <option key={tag.id} value={tag.id}>
                                {tag.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {!selectedTargetTagId && suggestion ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetTagByCluster((current) => ({
                                ...current,
                                [cluster.clusterId]: suggestion.tagId,
                              }));
                            }}
                            disabled={isAssigning}
                            className="inline-flex h-8 items-center rounded-md border border-primary bg-primary/10 px-3 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                          >
                            Use: {suggestion.tagLabel}
                          </button>
                        ) : null}
                        {!selectedTargetTagId ? (
                          <button
                            type="button"
                            onClick={() => handleStartNaming(cluster.clusterId)}
                            disabled={isAssigning}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs hover:bg-muted"
                          >
                            <UserPlus className="size-3" />
                            {UI_TEXT.nameGroup}
                          </button>
                        ) : null}
                      </>
                    )}
                    {isAssigning && !isNaming ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <div className="space-y-4">
                      {(() => {
                        const faceIdsForGrid = displayFaceIds;
                        const allRows = chunkArray(faceIdsForGrid, CLUSTER_FACE_GRID_COLS);
                        const showFilteredLoading =
                          Boolean(filterCacheKey) && !hasFilteredList;
                        return (
                          <>
                            {selectedTargetTagId ? (
                              <div
                                className="flex flex-wrap items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs font-medium text-muted-foreground">
                                  {UI_TEXT.showLabel}
                                </span>
                                {(
                                  [
                                    ["all", UI_TEXT.filterAll],
                                    ["matching", `Matching ≥ ${similarityHighPctLabel}%`],
                                    [
                                      "mid",
                                      `${similarityLowPctLabel}%–${similarityHighPctLabel}%`,
                                    ],
                                    ["below", `Below ${similarityLowPctLabel}%`],
                                  ] as const
                                ).map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => {
                                      setMemberFilterByClusterId((current) => ({
                                        ...current,
                                        [cluster.clusterId]: mode,
                                      }));
                                      setClusterMemberPageById((prev) => ({
                                        ...prev,
                                        [cluster.clusterId]: 0,
                                      }));
                                      if (
                                        mode === "all" &&
                                        expanded &&
                                        expandedCluster?.clusterId === cluster.clusterId
                                      ) {
                                        void loadClusterMemberPage(cluster, 0);
                                      }
                                    }}
                                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                      memberFilter === mode
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {showFilteredLoading ? (
                              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="size-5 animate-spin shrink-0" aria-hidden />
                                Loading filtered faces…
                              </div>
                            ) : null}
                            {!showFilteredLoading &&
                            filterCacheKey &&
                            hasFilteredList &&
                            filteredFullIds!.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{UI_TEXT.filterEmpty}</p>
                            ) : null}
                            {allRows.map((rowFaceIds, rowIndex) => {
                              const allDeclined = rowFaceIds.every((faceId) =>
                                declinedFaceSet.has(faceId),
                              );
                              const assignableRowFaceIds = rowFaceIds.filter(
                                (faceId) => !declinedFaceSet.has(faceId),
                              );
                              return (
                                <div
                                  key={`${cluster.clusterId}-row-${rowIndex}`}
                                  className="flex items-start gap-3"
                                >
                                  <div className="flex flex-col gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleAssignSpecificFaces(
                                          cluster.clusterId,
                                          rowIndex,
                                          assignableRowFaceIds,
                                        );
                                      }}
                                      disabled={
                                        isAssigning ||
                                        assignableRowFaceIds.length === 0 ||
                                        !selectedTargetTagId
                                      }
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                                      aria-label="Accept row"
                                      title="Accept row"
                                    >
                                      {pendingAcceptRow?.clusterId === cluster.clusterId &&
                                      pendingAcceptRow.rowIndex === rowIndex ? (
                                        <Loader2 className="size-5 animate-spin" aria-hidden />
                                      ) : (
                                        <Check className="size-5" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeclinedFaceIdsByCluster((current) => {
                                          const next = { ...current };
                                          const nextSet = new Set(next[cluster.clusterId] ?? []);
                                          if (allDeclined) {
                                            rowFaceIds.forEach((faceId) => nextSet.delete(faceId));
                                          } else {
                                            rowFaceIds.forEach((faceId) => nextSet.add(faceId));
                                          }
                                          next[cluster.clusterId] = Array.from(nextSet);
                                          return next;
                                        });
                                      }}
                                      disabled={isAssigning}
                                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50 ${
                                        allDeclined
                                          ? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/25"
                                          : "border-border text-muted-foreground"
                                      }`}
                                      aria-label={
                                        allDeclined ? "Undo hide for row" : "Hide row from accept"
                                      }
                                      title={allDeclined ? "Undo hide for row" : "Hide row from accept"}
                                    >
                                      <X className="size-5" />
                                    </button>
                                  </div>
                                  <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                                    {rowFaceIds.map((faceId) => {
                                      const faceInfo = expandedCluster?.faceInfos[faceId] ?? null;
                                      const isDeclined = declinedFaceSet.has(faceId);
                                      const isFaceAssigning =
                                        assigningFaceSet.has(faceId) || isAssigning;
                                      return (
                                        <div key={faceId}>
                                          <FaceThumbWithPreview
                                            faceInfo={faceInfo}
                                            sizeClassName="aspect-square w-full"
                                            isDeclined={isDeclined}
                                            onOpenPhoto={
                                              faceInfo
                                                ? () =>
                                                    onOpenFacePhoto({
                                                      sourcePath: faceInfo.sourcePath,
                                                      imageWidth: faceInfo.imageWidth,
                                                      imageHeight: faceInfo.imageHeight,
                                                      mediaItemId: null,
                                                    })
                                                : undefined
                                            }
                                          />
                                          <FaceSelectionFooter
                                            hidden={allDeclined}
                                            isDeclined={isDeclined}
                                            isDisabled={isFaceAssigning}
                                            scorePercentLabel={
                                              clusterSimilarities[faceId] !== undefined
                                                ? `${(clusterSimilarities[faceId] * 100).toFixed(1)}%`
                                                : undefined
                                            }
                                            onToggleDecline={() => {
                                              setDeclinedFaceIdsByCluster((current) => {
                                                const next = { ...current };
                                                const nextSet = new Set(next[cluster.clusterId] ?? []);
                                                if (nextSet.has(faceId)) {
                                                  nextSet.delete(faceId);
                                                } else {
                                                  nextSet.add(faceId);
                                                }
                                                next[cluster.clusterId] = Array.from(nextSet);
                                                return next;
                                              });
                                            }}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                            <PeoplePaginationBar
                              ariaLabel="Face thumbnails pagination"
                              currentPage={memberPage}
                              totalItems={memberPaginationTotal}
                              pageSize={CLUSTER_MEMBER_PAGE_SIZE}
                              disabled={isAssigning || showFilteredLoading}
                              onPageChange={(next) => {
                                const mf = memberFilterByClusterId[cluster.clusterId] ?? "all";
                                const tid = targetTagByCluster[cluster.clusterId] ?? "";
                                if (mf !== "all" && tid) {
                                  setClusterMemberPageById((prev) => ({
                                    ...prev,
                                    [cluster.clusterId]: next,
                                  }));
                                } else {
                                  void loadClusterMemberPage(cluster, next);
                                }
                              }}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          <PeoplePaginationBar
            ariaLabel="Face groups pagination"
            currentPage={clusterListPage}
            totalItems={clusterTotalCount}
            pageSize={CLUSTER_LIST_PAGE_SIZE}
            disabled={isLoading || isClusteringRunning}
            onPageChange={(next) => setClusterListPage(next)}
          />
        </div>
      )}
    </div>
  );
}
