import type { BrowserWindow } from "electron";
import type { PipelineId, PipelineProgressEvent } from "./pipeline-types";

/**
 * Context object handed to every pipeline runner during execution.
 *
 * The context centralises the surface area runners interact with so individual
 * pipelines stay agnostic of the scheduler internals. Specifically it provides:
 *   - cancellation: a single {@link AbortSignal} reflecting both user-initiated
 *     cancellation and bundle/scheduler-initiated cancellation.
 *   - progress reporting: {@link PipelineContext.report} pushes events through
 *     the scheduler, which mirrors them into the central renderer slice and
 *     into legacy per-pipeline progress channels (during the migration window).
 *   - identity: the bundleId and jobId so runners can correlate logs.
 *   - browser window handle: for pipelines that still need to push progress
 *     to a specific renderer (preserved for compatibility).
 */
export interface PipelineContext {
  readonly bundleId: string;
  readonly jobId: string;
  readonly pipelineId: PipelineId;
  /** Display label for the bundle this job belongs to (forwarded by scheduler). */
  readonly bundleDisplayName: string;
  /**
   * AbortSignal that fires when the job, bundle, or whole scheduler is
   * cancelled. Pipeline runners should pass this to long-running async work
   * (e.g. fetch / ONNX inference / DB iteration).
   */
  readonly signal: AbortSignal;
  /**
   * Push a typed progress event. Safe to call from any async context — the
   * scheduler routes the event onto the IPC channels.
   */
  report(event: PipelineProgressEvent): void;
  /**
   * The renderer window that initiated the bundle, if known. Optional because
   * background-triggered bundles (e.g. auto metadata scan after folder select)
   * may not have an originating window. Pipelines that previously sent
   * progress directly via `webContents.send` should prefer `report()` instead.
   */
  readonly originatorWindow?: BrowserWindow;
}
