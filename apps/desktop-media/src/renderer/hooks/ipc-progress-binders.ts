import type {
  FaceClusteringProgressEvent,
  GeocoderInitProgressEvent,
  PhotoAnalysisProgressEvent,
  FaceDetectionProgressEvent,
  MetadataScanProgressEvent,
  PathAnalysisProgressEvent,
  SemanticIndexProgressEvent,
  SimilarUntaggedCountsProgressEvent,
} from "../../shared/ipc";
import type { DesktopStore } from "../stores/desktop-store";
import {
  queueMetadataRefresh,
  refreshFolderAnalysisStatuses,
  refreshMetadataForItems,
} from "./ipc-binding-helpers";

const FOLDER_STATUS_REFRESH_INTERVAL_MS = 5_000;
type MetadataItemUpdatedEvent = Extract<MetadataScanProgressEvent, { type: "item-updated" }>;

function createFolderTransitionTracker(store: DesktopStore): (folderPath: string | undefined) => void {
  let lastFolder: string | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  return (folderPath: string | undefined) => {
    if (!folderPath || folderPath === lastFolder) return;
    lastFolder = folderPath;
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refreshFolderAnalysisStatuses(store);
    }, FOLDER_STATUS_REFRESH_INTERVAL_MS);
  };
}

export function bindPhotoAnalysisProgress(store: DesktopStore): () => void {
  const trackFolder = createFolderTransitionTracker(store);
  return window.desktopApi.onPhotoAnalysisProgress((event: PhotoAnalysisProgressEvent) => {
    const state = store.getState();

    if (event.type === "job-started") {
      store.setState((s) => {
        s.aiJobId = event.jobId;
        s.aiStatus = "running";
        s.aiPhase = "initializing-model";
        s.aiError = null;
        s.aiAverageSecondsPerFile = null;
        s.aiCurrentFolderPath = null;
        s.aiPanelVisible = true;
        s.aiItemOrder = event.items.map((i) => i.path);
        s.aiItemsByKey = {};
        for (const item of event.items) {
          s.aiItemsByKey[item.path] = {
            path: item.path,
            name: item.name,
            status: item.status,
          };
        }
        s.folderAnalysisByPath[event.folderPath] = {
          state: "in_progress",
          photoAnalyzedAt: s.folderAnalysisByPath[event.folderPath]?.photoAnalyzedAt ?? null,
          faceAnalyzedAt: s.folderAnalysisByPath[event.folderPath]?.faceAnalyzedAt ?? null,
          semanticIndexedAt: s.folderAnalysisByPath[event.folderPath]?.semanticIndexedAt ?? null,
          lastUpdatedAt: new Date().toISOString(),
        };
      });
      return;
    }

    if (state.aiJobId && state.aiJobId !== event.jobId) {
      return;
    }

    if (event.type === "item-updated") {
      store.setState((s) => {
        s.aiPhase = "analyzing";
        s.aiItemsByKey[event.item.path] = {
          path: event.item.path,
          name: event.item.name,
          status: event.item.status,
          elapsedSeconds: event.item.elapsedSeconds,
          result: event.item.result,
          error: event.item.error,
        };
        if (event.currentFolderPath) {
          s.aiCurrentFolderPath = event.currentFolderPath;
        }
      });
      trackFolder(event.currentFolderPath);
      if (event.item.status === "success") {
        queueMetadataRefresh(store, event.item.path);
      }
      return;
    }

    if (event.type === "phase-updated") {
      store.setState((s) => {
        s.aiPhase = event.phase;
      });
      return;
    }

    if (event.type === "job-completed") {
      store.setState((s) => {
        for (const path of s.aiItemOrder) {
          const item = s.aiItemsByKey[path];
          if (item && (item.status === "pending" || item.status === "running")) {
            item.status = "cancelled";
            item.elapsedSeconds = item.elapsedSeconds ?? 0;
            item.error = item.error ?? "Cancelled by user";
          }
        }
        s.aiStatus = "completed";
        s.aiPhase = null;
        s.aiJobId = null;
        s.aiAverageSecondsPerFile = event.averageSecondsPerFile;
        s.aiCurrentFolderPath = null;
      });
      void refreshFolderAnalysisStatuses(store);
    }
  });
}

export function bindFaceDetectionProgress(store: DesktopStore): () => void {
  const trackFolder = createFolderTransitionTracker(store);
  return window.desktopApi.onFaceDetectionProgress((event: FaceDetectionProgressEvent) => {
    const state = store.getState();

    if (event.type === "job-started") {
      store.setState((s) => {
        s.faceJobId = event.jobId;
        s.faceStatus = "running";
        s.faceError = null;
        s.facePanelVisible = true;
        s.faceAverageSecondsPerFile = null;
        s.faceCurrentFolderPath = null;
        s.faceItemOrder = event.items.map((i) => i.path);
        s.faceItemsByKey = {};
        for (const item of event.items) {
          s.faceItemsByKey[item.path] = {
            path: item.path,
            name: item.name,
            status: item.status,
          };
        }
        s.folderAnalysisByPath[event.folderPath] = {
          state: "in_progress",
          photoAnalyzedAt: s.folderAnalysisByPath[event.folderPath]?.photoAnalyzedAt ?? null,
          faceAnalyzedAt: s.folderAnalysisByPath[event.folderPath]?.faceAnalyzedAt ?? null,
          semanticIndexedAt: s.folderAnalysisByPath[event.folderPath]?.semanticIndexedAt ?? null,
          lastUpdatedAt: new Date().toISOString(),
        };
      });
      return;
    }

    if (state.faceJobId && state.faceJobId !== event.jobId) {
      return;
    }

    if (event.type === "item-updated") {
      store.setState((s) => {
        s.faceItemsByKey[event.item.path] = {
          path: event.item.path,
          name: event.item.name,
          status: event.item.status,
          elapsedSeconds: event.item.elapsedSeconds,
          faceCount: event.item.result?.faceCount,
          result: event.item.result,
          error: event.item.error,
        };
        if (event.currentFolderPath) {
          s.faceCurrentFolderPath = event.currentFolderPath;
        }
      });
      trackFolder(event.currentFolderPath);
      if (event.item.status === "success") {
        queueMetadataRefresh(store, event.item.path);
      }
      return;
    }

    if (event.type === "job-completed") {
      store.setState((s) => {
        for (const path of s.faceItemOrder) {
          const item = s.faceItemsByKey[path];
          if (item && (item.status === "pending" || item.status === "running")) {
            item.status = "cancelled";
            item.elapsedSeconds = item.elapsedSeconds ?? 0;
            item.error = item.error ?? "Cancelled by user";
          }
        }
        s.faceStatus = "completed";
        s.faceAverageSecondsPerFile = event.averageSecondsPerFile;
        s.faceCurrentFolderPath = null;
      });
      const images = store.getState().mediaItems;
      if (images.length > 0) {
        void refreshMetadataForItems(store, images);
      }
      void refreshFolderAnalysisStatuses(store);
    }
  });
}

const METADATA_AUTO_HIDE_DELAY_MS = 0;

/** Same idea as metadata auto-hide: dismiss People similar-counts card when the job succeeds. */
const SIMILAR_UNTAGGED_COUNTS_AUTO_HIDE_MS = 0;

let similarUntaggedCountsAutoHideTimer: number | null = null;

function clearSimilarUntaggedCountsAutoHideTimer(): void {
  if (similarUntaggedCountsAutoHideTimer !== null) {
    window.clearTimeout(similarUntaggedCountsAutoHideTimer);
    similarUntaggedCountsAutoHideTimer = null;
  }
}
let metadataAutoHideTimer: number | null = null;

function clearMetadataAutoHideTimer(): void {
  if (metadataAutoHideTimer !== null) {
    window.clearTimeout(metadataAutoHideTimer);
    metadataAutoHideTimer = null;
  }
}

export function bindMetadataScanProgress(store: DesktopStore): () => void {
  const pendingItemsByPath = new Map<string, MetadataItemUpdatedEvent["item"]>();
  let pendingCurrentFolderPath: string | null = null;
  let flushTimer: number | null = null;

  const flushPendingItems = (): void => {
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (pendingItemsByPath.size === 0 && !pendingCurrentFolderPath) {
      return;
    }
    const pendingItems = Array.from(pendingItemsByPath.values());
    const folderPath = pendingCurrentFolderPath;
    pendingItemsByPath.clear();
    pendingCurrentFolderPath = null;
    store.setState((s) => {
      for (const item of pendingItems) {
        s.metadataItemsByKey[item.path] = {
          path: item.path,
          name: item.name,
          status: item.status,
          action: item.action,
          mediaItemId: item.mediaItemId,
          error: item.error,
        };
      }
      if (folderPath) {
        s.metadataCurrentFolderPath = folderPath;
      }
    });
  };

  const scheduleFlush = (): void => {
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      flushPendingItems();
    }, 80);
  };

  const removeListener = window.desktopApi.onMetadataScanProgress((event: MetadataScanProgressEvent) => {
    const state = store.getState();

    if (event.type === "job-started") {
      flushPendingItems();
      console.log(`[metadata-scan][renderer][${new Date().toISOString()}] job-started received jobId=${event.jobId} total=${event.total}`);
      clearMetadataAutoHideTimer();
      store.setState((s) => {
        s.metadataJobId = event.jobId;
        s.metadataStatus = "running";
        s.metadataError = null;
        s.metadataPanelVisible = true;
        s.metadataSummary = null;
        s.metadataCurrentFolderPath = event.folderPath;
        s.metadataPhase = "preparing";
        s.metadataPhaseProcessed = 0;
        s.metadataPhaseTotal = event.total;
        s.metadataItemOrder = [];
        s.metadataItemsByKey = {};
      });
      console.log(`[metadata-scan][renderer][${new Date().toISOString()}] job-started state updated`);
      return;
    }

    if (state.metadataJobId && state.metadataJobId !== event.jobId) {
      return;
    }

    if (event.type === "phase-updated") {
      flushPendingItems();
      store.setState((s) => {
        s.metadataPhase = event.phase;
        s.metadataPhaseProcessed = event.processed;
        s.metadataPhaseTotal = event.total;
      });
      return;
    }

    if (event.type === "item-updated") {
      pendingItemsByPath.set(event.item.path, event.item);
      if (event.currentFolderPath) {
        pendingCurrentFolderPath = event.currentFolderPath;
      }
      scheduleFlush();
      return;
    }

    if (event.type === "job-completed") {
      flushPendingItems();
      console.log(
        `[metadata-scan][renderer][${new Date().toISOString()}] job-completed received jobId=${event.jobId} created=${event.created} updated=${event.updated} unchanged=${event.unchanged} cancelled=${event.cancelled} needsAiFollowUp=${event.filesNeedingAiPipelineFollowUp}`,
      );
      const wasRunning = store.getState().metadataStatus === "running";
      const completedJobId = event.jobId;
      const hadChanges = event.created > 0 || event.updated > 0;
      const foldersNeedingAiFollowUpCount = event.foldersTouched.filter(
        (ft) => ft.needsAiFollowUp > 0,
      ).length;

      store.setState((s) => {
        s.metadataStatus = "completed";
        s.metadataCurrentFolderPath = null;
        s.metadataPhase = null;
        s.metadataPhaseProcessed = 0;
        s.metadataPhaseTotal = 0;
        s.metadataSummary = {
          total: event.total,
          created: event.created,
          updated: event.updated,
          unchanged: event.unchanged,
          failed: event.failed,
          cancelled: event.cancelled,
        };
        if (event.foldersTouched.length > 0) {
          for (const ft of event.foldersTouched) {
            if (ft.created > 0 || ft.updated > 0) {
              s.foldersWithCatalogChanges[ft.folderPath] = true;
            }
          }
        }
        if (event.filesNeedingAiPipelineFollowUp > 0) {
          s.metadataScanFollowUp = {
            scanRootFolderPath: event.folderPath,
            filesNeedingAiPipelineFollowUp: event.filesNeedingAiPipelineFollowUp,
            foldersNeedingAiFollowUpCount,
          };
        }
      });

      if (wasRunning && event.created === 0 && event.updated === 0) {
        clearMetadataAutoHideTimer();
        metadataAutoHideTimer = window.setTimeout(() => {
          metadataAutoHideTimer = null;
          const current = store.getState();
          if (
            current.metadataStatus === "completed" &&
            current.metadataPanelVisible &&
            current.metadataJobId === completedJobId
          ) {
            store.getState().setMetadataPanelVisible(false);
          }
        }, METADATA_AUTO_HIDE_DELAY_MS);
      }

      if (hadChanges) {
        const images = store.getState().mediaItems;
        if (images.length > 0) {
          void refreshMetadataForItems(store, images);
        }
      }

      void refreshFolderAnalysisStatuses(store);
    }
  });

  return () => {
    removeListener();
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    clearMetadataAutoHideTimer();
  };
}

export function bindFaceClusteringProgress(store: DesktopStore): () => void {
  return window.desktopApi.onFaceClusteringProgress((event: FaceClusteringProgressEvent) => {
    const state = store.getState();

    if (event.type === "job-started") {
      store.setState((s) => {
        s.faceClusteringJobId = event.jobId;
        s.faceClusteringStatus = "running";
        s.faceClusteringError = null;
        s.faceClusteringPhase = "loading";
        s.faceClusteringProcessed = 0;
        s.faceClusteringTotal = Math.max(1, event.totalFaces);
        s.faceClusteringTotalFaces = event.totalFaces;
        s.faceClusteringClusterCount = null;
        s.faceClusteringPanelVisible = true;
      });
      return;
    }

    if (state.faceClusteringJobId && state.faceClusteringJobId !== event.jobId) {
      return;
    }

    if (event.type === "progress") {
      store.setState((s) => {
        s.faceClusteringPhase = event.phase;
        s.faceClusteringProcessed = event.processed;
        s.faceClusteringTotal = Math.max(1, event.total);
      });
      return;
    }

    if (event.type === "job-completed") {
      store.setState((s) => {
        s.faceClusteringStatus = "completed";
        s.faceClusteringPhase = null;
        s.faceClusteringClusterCount = event.clusterCount;
        s.faceClusteringProcessed = s.faceClusteringTotal;
      });
      return;
    }

    if (event.type === "job-failed") {
      store.setState((s) => {
        s.faceClusteringStatus = "failed";
        s.faceClusteringPhase = null;
        s.faceClusteringError = event.error;
      });
      return;
    }

    if (event.type === "job-cancelled") {
      store.setState((s) => {
        s.faceClusteringStatus = "cancelled";
        s.faceClusteringPhase = null;
      });
      return;
    }
  });
}

export function bindSemanticIndexProgress(store: DesktopStore): () => void {
  const trackFolder = createFolderTransitionTracker(store);
  return window.desktopApi.onSemanticIndexProgress((event: SemanticIndexProgressEvent) => {
    const state = store.getState();

    if (event.type === "job-started") {
      store.setState((s) => {
        s.semanticIndexJobId = event.jobId;
        s.semanticIndexStatus = "running";
        s.semanticIndexError = null;
        s.semanticIndexPanelVisible = true;
        s.semanticIndexAverageSecondsPerFile = null;
        s.semanticIndexCurrentFolderPath = null;
        s.semanticIndexItemOrder = event.items.map((i) => i.path);
        s.semanticIndexItemsByKey = {};
        for (const item of event.items) {
          s.semanticIndexItemsByKey[item.path] = {
            path: item.path,
            name: item.name,
            status: item.status,
          };
        }
        s.folderAnalysisByPath[event.folderPath] = {
          state: "in_progress",
          photoAnalyzedAt: s.folderAnalysisByPath[event.folderPath]?.photoAnalyzedAt ?? null,
          faceAnalyzedAt: s.folderAnalysisByPath[event.folderPath]?.faceAnalyzedAt ?? null,
          semanticIndexedAt: s.folderAnalysisByPath[event.folderPath]?.semanticIndexedAt ?? null,
          lastUpdatedAt: new Date().toISOString(),
        };
        s.semanticIndexPhase = "initializing-model";
      });
      return;
    }

    if (state.semanticIndexJobId && state.semanticIndexJobId !== event.jobId) {
      return;
    }

    if (event.type === "phase-updated") {
      store.setState((s) => {
        s.semanticIndexPhase = "indexing";
      });
      return;
    }

    if (event.type === "item-updated") {
      store.setState((s) => {
        s.semanticIndexItemsByKey[event.item.path] = {
          path: event.item.path,
          name: event.item.name,
          status: event.item.status,
          elapsedSeconds: event.item.elapsedSeconds,
          error: event.item.error,
        };
        if (event.currentFolderPath) {
          s.semanticIndexCurrentFolderPath = event.currentFolderPath;
        }
      });
      trackFolder(event.currentFolderPath);
      return;
    }

    if (event.type === "job-completed") {
      store.setState((s) => {
        for (const path of s.semanticIndexItemOrder) {
          const item = s.semanticIndexItemsByKey[path];
          if (item && (item.status === "pending" || item.status === "running")) {
            item.status = "cancelled";
            item.elapsedSeconds = item.elapsedSeconds ?? 0;
            item.error = item.error ?? "Cancelled by user";
          }
        }
        s.semanticIndexStatus = "completed";
        s.semanticIndexAverageSecondsPerFile = event.averageSecondsPerFile;
        s.semanticIndexCurrentFolderPath = null;
        s.semanticIndexPhase = null;
      });
      void refreshFolderAnalysisStatuses(store);
    }
  });
}

export function bindSimilarUntaggedCountsProgress(store: DesktopStore): () => void {
  const removeListener = window.desktopApi.onSimilarUntaggedCountsProgress(
    (event: SimilarUntaggedCountsProgressEvent) => {
      const state = store.getState();

      if (event.type === "job-started") {
        clearSimilarUntaggedCountsAutoHideTimer();
        store.setState((s) => {
          s.similarUntaggedCountsJobId = event.jobId;
          s.similarUntaggedCountsStatus = "running";
          s.similarUntaggedCountsError = null;
          s.similarUntaggedCountsProcessed = 0;
          s.similarUntaggedCountsTotal = Math.max(1, event.total);
          s.similarUntaggedCountsPanelVisible = true;
          for (const tid of event.tagIds) {
            delete s.similarUntaggedCountsByTagId[tid];
          }
        });
        return;
      }

      // After dismiss/reset, jobId is cleared — ignore stale progress/completion from the old job.
      if (!state.similarUntaggedCountsJobId || state.similarUntaggedCountsJobId !== event.jobId) {
        return;
      }

      if (event.type === "progress") {
        store.setState((s) => {
          s.similarUntaggedCountsProcessed = event.processed;
          s.similarUntaggedCountsTotal = Math.max(1, event.total);
          for (const [k, v] of Object.entries(event.counts)) {
            s.similarUntaggedCountsByTagId[k] = v;
          }
        });
        return;
      }

      if (event.type === "job-completed") {
        const completedJobId = event.jobId;
        clearSimilarUntaggedCountsAutoHideTimer();
        store.setState((s) => {
          s.similarUntaggedCountsStatus = "completed";
          const n = Object.keys(event.counts).length;
          s.similarUntaggedCountsProcessed = n;
          s.similarUntaggedCountsTotal = Math.max(1, n);
          for (const [k, v] of Object.entries(event.counts)) {
            s.similarUntaggedCountsByTagId[k] = v;
          }
        });
        similarUntaggedCountsAutoHideTimer = window.setTimeout(() => {
          similarUntaggedCountsAutoHideTimer = null;
          const current = store.getState();
          if (
            current.similarUntaggedCountsStatus === "completed" &&
            current.similarUntaggedCountsPanelVisible &&
            current.similarUntaggedCountsJobId === completedJobId
          ) {
            current.setSimilarUntaggedCountsPanelVisible(false);
            current.resetSimilarUntaggedCountsJob();
          }
        }, SIMILAR_UNTAGGED_COUNTS_AUTO_HIDE_MS);
        return;
      }

      if (event.type === "job-failed") {
        store.setState((s) => {
          s.similarUntaggedCountsStatus = "failed";
          s.similarUntaggedCountsError = event.error;
        });
        return;
      }

      if (event.type === "job-cancelled") {
        store.setState((s) => {
          s.similarUntaggedCountsStatus = "cancelled";
        });
      }
    },
  );

  return () => {
    clearSimilarUntaggedCountsAutoHideTimer();
    removeListener();
  };
}

export function bindPathAnalysisProgress(store: DesktopStore): () => void {
  const trackFolder = createFolderTransitionTracker(store);
  return window.desktopApi.onPathAnalysisProgress((event: PathAnalysisProgressEvent) => {
    if (event.type === "job-started") {
      store.setState((s) => {
        s.pathAnalysisJobId = event.jobId;
        s.pathAnalysisStatus = "running";
        s.pathAnalysisProcessed = 0;
        s.pathAnalysisTotal = Math.max(0, event.total);
        s.pathAnalysisFolderPath = event.folderPath;
        s.pathAnalysisPanelVisible = true;
        s.pathAnalysisError = null;
      });
      return;
    }

    const state = store.getState();
    if (state.pathAnalysisJobId && state.pathAnalysisJobId !== event.jobId) {
      return;
    }

    if (event.type === "progress") {
      const folderPath = store.getState().pathAnalysisFolderPath;
      trackFolder(folderPath ?? undefined);
      store.setState((s) => {
        s.pathAnalysisProcessed = event.processed;
        s.pathAnalysisTotal = Math.max(1, event.total);
      });
      return;
    }

    if (event.type === "job-completed") {
      trackFolder(event.folderPath);
      store.setState((s) => {
        s.pathAnalysisStatus = "idle";
        s.pathAnalysisJobId = null;
        s.pathAnalysisProcessed = event.processed;
        s.pathAnalysisTotal = event.total;
        const partialFail = event.failed > 0;
        s.pathAnalysisError = partialFail ? `${event.failed} file(s) could not be updated` : null;
        s.pathAnalysisPanelVisible = partialFail;
      });
      void refreshFolderAnalysisStatuses(store);
      const images = store.getState().mediaItems;
      if (images.length > 0) {
        void refreshMetadataForItems(store, images);
      }
      return;
    }

    if (event.type === "job-cancelled") {
      store.setState((s) => {
        s.pathAnalysisStatus = "idle";
        s.pathAnalysisJobId = null;
        s.pathAnalysisPanelVisible = false;
      });
    }
  });
}

export function bindGeocoderInitProgress(store: DesktopStore): () => void {
  return window.desktopApi.onGeocoderInitProgress((event: GeocoderInitProgressEvent) => {
    store.getState().setGeocoderInitStatus(event.status, event.error);
  });
}
