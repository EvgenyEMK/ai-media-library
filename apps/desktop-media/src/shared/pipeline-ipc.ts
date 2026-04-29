/**
 * IPC channel contract for the central pipeline orchestration layer.
 *
 * The orchestration adds:
 *   - request channels on `pipelines:*` (enqueue / cancel / etc.)
 *   - push channels for queue snapshots, per-job progress, and lifecycle events
 *
 * Renderer code should prefer `window.desktopApi.pipelines.*` (added in
 * preload) and use the shared types here for payloads.
 *
 * Note: progress events here are the *generic* events emitted by the
 * scheduler. Pipeline-specific richer progress events (e.g.
 * `MetadataScanProgressEvent`) continue to be emitted on their existing
 * channels during the migration and can be removed once the renderer is fully
 * driven by the central queue slice.
 */

import type {
  EnqueueRejection,
  JobProgressSnapshot,
  PipelineId,
  PipelineLifecycleEvent,
  PipelineQueueSnapshot,
} from "./pipeline-types";

/**
 * Channel identifiers grouped under a `pipelines` namespace so they don't
 * collide with the legacy `media:*` channels.
 */
export const PIPELINE_IPC_CHANNELS = {
  enqueueBundle: "pipelines:enqueue-bundle",
  cancelBundle: "pipelines:cancel-bundle",
  cancelJob: "pipelines:cancel-job",
  removeQueued: "pipelines:remove-queued",
  clearQueue: "pipelines:clear-queue",
  getSnapshot: "pipelines:get-snapshot",
  /** Push event: full queue snapshot whenever scheduler state changes. */
  queueChanged: "pipelines:queue-changed",
  /** Push event: per-job progress updates. */
  jobProgress: "pipelines:job-progress",
  /** Push event: lifecycle transitions (queued/started/finished). */
  lifecycle: "pipelines:lifecycle",
} as const;

/**
 * Request payload for enqueuing a preset bundle.
 *
 * `params` and `inputBinding.mapper` are not JSON-serialisable as live
 * closures, so the renderer cannot construct arbitrary bundles directly. The
 * orchestration handler in main accepts a `presetId` (resolved against a
 * registry of preset composers) plus a typed args bag.
 */
export interface EnqueueBundlePresetRequest {
  /**
   * Discriminator selecting a preset bundle composer registered in the main
   * process (e.g. "full-folder-index", "metadata-only").
   */
  presetId: string;
  /** Display name override (defaults to the preset's own display name). */
  displayName?: string;
  /** Free-form preset args (e.g. `{ folderPath, recursive }`) typed per preset. */
  args?: Record<string, unknown>;
}

/**
 * Lower-level enqueue request for callers that already have a fully-described
 * single-job bundle (used by the legacy facades that wrap existing IPC handlers).
 */
export interface EnqueueSingleJobRequest {
  pipelineId: PipelineId;
  /** Display name shown in the dock. */
  displayName: string;
  params: unknown;
}

export type EnqueueBundleRequest =
  | { kind: "preset"; payload: EnqueueBundlePresetRequest }
  | { kind: "single-job"; payload: EnqueueSingleJobRequest };

/**
 * Result of `enqueueBundle` returned to the renderer.
 */
export type EnqueueBundleResponse =
  | { ok: true; bundleId: string }
  | { ok: false; rejection: EnqueueRejection };

/**
 * Push payload for the `pipelines:job-progress` event. The renderer's central
 * queue slice merges these into the matching `JobView.progress`.
 */
export interface JobProgressPushEvent {
  bundleId: string;
  jobId: string;
  pipelineId: PipelineId;
  progress: JobProgressSnapshot;
}

/**
 * Convenience: fully expanded surface of pipeline IPC available on
 * `window.desktopApi.pipelines.*`. The preload bridges these to the channels
 * declared in {@link PIPELINE_IPC_CHANNELS}.
 */
export interface PipelineDesktopApi {
  enqueueBundle: (request: EnqueueBundleRequest) => Promise<EnqueueBundleResponse>;
  cancelBundle: (bundleId: string) => Promise<boolean>;
  cancelJob: (jobId: string) => Promise<boolean>;
  removeQueued: (bundleId: string) => Promise<boolean>;
  clearQueue: () => Promise<void>;
  getSnapshot: () => Promise<PipelineQueueSnapshot>;
  onQueueChanged: (listener: (snapshot: PipelineQueueSnapshot) => void) => () => void;
  onJobProgress: (listener: (event: JobProgressPushEvent) => void) => () => void;
  onLifecycle: (listener: (event: PipelineLifecycleEvent) => void) => () => void;
}
