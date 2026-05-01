import { useEffect } from "react";
import type { JobView, PipelineId, PipelineQueueSnapshot } from "../../shared/pipeline-types";
import { queueMetadataRefresh } from "./ipc-binding-helpers";
import { useDesktopStoreApi } from "../stores/desktop-store";
import type { AiPipelineCompletionSignal } from "../stores/desktop-slice";
import type { DesktopStore } from "../stores/desktop-store";

const summaryPipelineKindByPipelineId: Partial<Record<PipelineId, AiPipelineCompletionSignal["kind"]>> = {
  "photo-analysis": "photo",
  "face-detection": "face",
  "semantic-index": "semantic",
  "image-rotation-precheck": "rotation",
  "path-llm-analysis": "path-llm",
};

function folderPathFromJobParams(params: unknown): string | null {
  if (!params || typeof params !== "object" || !("folderPath" in params)) return null;
  const folderPath = (params as { folderPath?: unknown }).folderPath;
  return typeof folderPath === "string" && folderPath.trim().length > 0 ? folderPath : null;
}

function completionSignalFromJob(job: JobView): AiPipelineCompletionSignal | null {
  const kind = summaryPipelineKindByPipelineId[job.pipelineId];
  const hasProcessedOnCancel =
    job.state === "cancelled" && typeof job.progress.processed === "number" && job.progress.processed > 0;
  if (!kind || (job.state !== "succeeded" && job.state !== "failed" && !hasProcessedOnCancel)) return null;
  const folderPath = folderPathFromJobParams(job.params);
  if (!folderPath) return null;
  return {
    jobId: job.jobId,
    folderPath,
    kind,
    completedAt: new Date(job.finishedAt ?? Date.now()).toISOString(),
  };
}

export function syncSummaryPipelineCompletionsFromQueueSnapshot(
  store: DesktopStore,
  snapshot: PipelineQueueSnapshot,
  seenJobIds: Set<string>,
): void {
  const completions: AiPipelineCompletionSignal[] = [];
  for (const bundle of snapshot.recent) {
    for (const job of bundle.jobs) {
      if (seenJobIds.has(job.jobId)) continue;
      const signal = completionSignalFromJob(job);
      if (!signal) continue;
      seenJobIds.add(job.jobId);
      completions.push(signal);
    }
  }
  if (completions.length === 0) return;
  store.setState((state) => {
    state.lastAiPipelineCompletion = completions[completions.length - 1]!;
  });
}

/**
 * Subscribes the renderer-side `pipelineQueueSlice` to the central
 * orchestration channels exposed via `window.desktopApi.pipelines`. Mounts a
 * single hook from `App.tsx` (sibling to the legacy `useDesktopIpcBindings`).
 *
 * On mount, also primes the store with a one-shot `getSnapshot()` call so the
 * dock has data before the next push event arrives.
 */
export function usePipelineQueueBinding(): void {
  const store = useDesktopStoreApi();

  useEffect(() => {
    const api = window.desktopApi.pipelines;
    if (!api) return;
    const seenCompletedSummaryJobIds = new Set<string>();

    void api
      .getSnapshot()
      .then((snapshot) => {
        store.getState().setPipelineQueueSnapshot(snapshot);
        syncSummaryPipelineCompletionsFromQueueSnapshot(store, snapshot, seenCompletedSummaryJobIds);
      })
      .catch((err: unknown) => {
        // Snapshot priming is best-effort; subsequent push events will hydrate.
        console.warn("[pipeline-queue] initial getSnapshot failed", err);
      });

    const offQueueChanged = api.onQueueChanged((snapshot) => {
      store.getState().setPipelineQueueSnapshot(snapshot);
      syncSummaryPipelineCompletionsFromQueueSnapshot(store, snapshot, seenCompletedSummaryJobIds);
    });
    const offJobProgress = api.onJobProgress((event) => {
      store.getState().patchJobProgress(event.bundleId, event.jobId, event.progress);
      if (event.pipelineId === "photo-analysis") {
        const details = event.progress.details;
        if (details && typeof details === "object") {
          const rec = details as Record<string, unknown>;
          const path = rec.path;
          if (typeof path === "string" && path.length > 0 && rec.error === undefined) {
            queueMetadataRefresh(store, path);
          }
        }
      }
    });
    const offLifecycle = api.onLifecycle((event) => {
      store.getState().appendPipelineLifecycle(event);
    });

    return () => {
      offQueueChanged();
      offJobProgress();
      offLifecycle();
    };
  }, [store]);
}
