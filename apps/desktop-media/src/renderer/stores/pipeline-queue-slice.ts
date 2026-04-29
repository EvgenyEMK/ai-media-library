import type { StateCreator } from "zustand";
import type {
  BundleView,
  JobView,
  PipelineLifecycleEvent,
  PipelineQueueSnapshot,
} from "../../shared/pipeline-types";

/**
 * Renderer-side slice powering the new central "Background operations" panel.
 *
 * The slice mirrors the main-process scheduler's snapshot. Updates flow in two
 * ways:
 *   1. Full snapshots via `pipelines:queue-changed` (authoritative; clobbers
 *      the stored arrays). Replays on every scheduler-relevant event.
 *   2. Per-job progress patches via `pipelines:job-progress` (cheap path that
 *      only mutates the matching `JobView.progress` to keep card progress
 *      bars buttery without re-rendering full lists).
 *
 * Lifecycle events feed into the small `recentLifecycle` ring buffer so the
 * dock can render toast-like fly-ins for completion notifications.
 */
export interface PipelineQueueSlice {
  /** Bundles with at least one running job. Kept in scheduler order. */
  pipelineRunning: BundleView[];
  /** Fully-queued bundles (FIFO). */
  pipelineQueued: BundleView[];
  /** Bundles in a terminal state, capped to the dock's display window. */
  pipelineRecent: BundleView[];
  /** Last several lifecycle events (newest first). Capped to ~10 entries. */
  pipelineLifecycleLog: PipelineLifecycleEvent[];

  /** Apply a full snapshot from the scheduler. Authoritative. */
  setPipelineQueueSnapshot: (snapshot: PipelineQueueSnapshot) => void;
  /** Cheap progress patch — locates the job by id and mutates its progress in place. */
  patchJobProgress: (
    bundleId: string,
    jobId: string,
    progress: JobView["progress"],
  ) => void;
  /** Append a lifecycle event. */
  appendPipelineLifecycle: (event: PipelineLifecycleEvent) => void;
  /** Clear the lifecycle log (used after a manual "dismiss"). */
  clearPipelineLifecycleLog: () => void;
}

const LIFECYCLE_LOG_LIMIT = 10;

export const createPipelineQueueSlice: StateCreator<
  PipelineQueueSlice,
  [["zustand/immer", never]]
> = (set) => ({
  pipelineRunning: [],
  pipelineQueued: [],
  pipelineRecent: [],
  pipelineLifecycleLog: [],

  setPipelineQueueSnapshot: (snapshot) =>
    set((state) => {
      state.pipelineRunning = snapshot.running;
      state.pipelineQueued = snapshot.queued;
      state.pipelineRecent = snapshot.recent;
    }),

  patchJobProgress: (bundleId, jobId, progress) =>
    set((state) => {
      const buckets: Array<keyof Pick<PipelineQueueSlice, "pipelineRunning" | "pipelineQueued">> = [
        "pipelineRunning",
        "pipelineQueued",
      ];
      for (const bucket of buckets) {
        const bundle = state[bucket].find((b) => b.bundleId === bundleId);
        if (!bundle) continue;
        const job = bundle.jobs.find((j) => j.jobId === jobId);
        if (!job) continue;
        job.progress = { ...progress };
        return;
      }
    }),

  appendPipelineLifecycle: (event) =>
    set((state) => {
      state.pipelineLifecycleLog.unshift(event);
      if (state.pipelineLifecycleLog.length > LIFECYCLE_LOG_LIMIT) {
        state.pipelineLifecycleLog.length = LIFECYCLE_LOG_LIMIT;
      }
    }),

  clearPipelineLifecycleLog: () =>
    set((state) => {
      state.pipelineLifecycleLog = [];
    }),
});
