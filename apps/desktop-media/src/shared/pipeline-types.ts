/**
 * Shared (renderer + main) pipeline type definitions.
 *
 * This module holds the *serialisable* pipeline shapes used across the IPC
 * boundary (snapshots, views, settings, lifecycle events). Electron-only
 * mutables (running `Job`, `Bundle`, `PipelineProgressEvent`, scheduler
 * internals) live in `electron/pipelines/pipeline-types.ts`.
 *
 * Renderer code should always import from this file; main-process code may
 * import from either side as convenient.
 */

/**
 * Concurrency groups used to throttle pipelines that compete for the same
 * underlying resource (GPU, Ollama, CPU, IO).
 */
export type PipelineConcurrencyGroup = "gpu" | "ollama" | "cpu" | "io";

/**
 * Identifier for a pipeline kind. Defined as a string-literal union so the
 * registry can verify a definition is registered before scheduling. New
 * pipeline kinds should add a string literal here.
 */
export type PipelineId =
  | "metadata-scan"
  | "path-rule-extraction"
  | "gps-geocode"
  | "geocoder-init"
  | "image-rotation-precheck"
  | "face-detection"
  | "face-embedding"
  | "face-clustering"
  | "photo-analysis"
  | "description-embedding"
  | "semantic-index"
  | "desc-embedding-backfill"
  | "path-llm-analysis"
  | "similar-untagged-counts";

/**
 * Lifecycle state of a single job inside a bundle.
 */
export type JobState =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped";

/**
 * Lifecycle state of a bundle (aggregate of its jobs).
 */
export type BundleState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partial";

/**
 * Snapshot of progress for a single job; updated in place as `report()` events
 * arrive in the main process and pushed to the renderer.
 */
export interface JobProgressSnapshot {
  /** Last reported phase string (pipeline-defined; e.g. "scanning", "geocoding"). */
  phase: string | null;
  processed: number;
  total: number | null;
  /** Human-readable status line, suitable for display in cards. */
  message: string | null;
  /** Pipeline-specific extra payload, kept opaque to the scheduler. */
  details: unknown | null;
  /** Wall-clock time when the most recent progress event was received (ms since epoch). */
  lastUpdatedAt: number;
}

/**
 * Read-only view of a job for events / IPC payloads.
 */
export interface JobView {
  jobId: string;
  pipelineId: PipelineId;
  /** Original serialisable job params, included so renderer UI can match folder-scoped jobs. */
  params: unknown;
  state: JobState;
  progress: JobProgressSnapshot;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

/**
 * Read-only view of a bundle, suitable for the renderer's pipeline queue slice.
 */
export interface BundleView {
  bundleId: string;
  displayName: string;
  state: BundleState;
  jobs: JobView[];
  enqueuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

/**
 * Snapshot of the entire scheduler queue.
 */
export interface PipelineQueueSnapshot {
  /** Bundles with at least one running job (ordered by start time, oldest first). */
  running: BundleView[];
  /** Bundles still fully queued (FIFO). */
  queued: BundleView[];
  /** Bundles in a terminal state, kept for short-term display in the dock. */
  recent: BundleView[];
}

/**
 * Per-group concurrency limits. The defaults preserve today's behaviour
 * (heavy AI pipelines stay strictly serial); users may relax them via Desktop
 * Settings.
 */
export interface PipelineConcurrencyConfig {
  groupLimits: Record<PipelineConcurrencyGroup, number>;
  /** Optional per-pipeline override of the default concurrency group. */
  perPipelineGroupOverride?: Partial<Record<PipelineId, PipelineConcurrencyGroup>>;
}

/** Default group limits, applied when settings are missing or malformed. */
export const DEFAULT_PIPELINE_CONCURRENCY: PipelineConcurrencyConfig = {
  groupLimits: { gpu: 1, ollama: 1, cpu: 2, io: 2 },
  perPipelineGroupOverride: undefined,
};

/**
 * Lifecycle event emitted by the scheduler over IPC.
 */
export type PipelineLifecycleEvent =
  | { type: "bundle-queued"; bundleId: string; displayName: string }
  | { type: "bundle-started"; bundleId: string }
  | { type: "job-started"; bundleId: string; jobId: string; pipelineId: PipelineId }
  | {
      type: "job-finished";
      bundleId: string;
      jobId: string;
      pipelineId: PipelineId;
      state: JobState;
      error: string | null;
    }
  | { type: "bundle-finished"; bundleId: string; state: BundleState };

/**
 * Reasons a Bundle/Job can be rejected at enqueue time.
 */
export type EnqueueRejection =
  | { kind: "unknown-pipeline"; pipelineId: string }
  | { kind: "invalid-binding"; bundleId: string; jobId: string; reason: string }
  | { kind: "validation-failed"; jobId: string; pipelineId: PipelineId; issues: string }
  | {
      kind: "duplicate-active-job";
      pipelineId: PipelineId;
      folderPath: string;
      existingFolderPath: string;
      existingBundleId: string;
      existingJobId: string;
      reason: string;
    };
