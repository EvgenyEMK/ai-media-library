/**
 * Main-process pipeline types.
 *
 * Re-exports the serialisable types from `src/shared/pipeline-types.ts` and
 * adds main-only types: `Job`, `Bundle`, `InputBinding`, and
 * `PipelineProgressEvent`.
 *
 * See `pipeline-scheduler.ts` for the in-memory orchestration that consumes
 * these types.
 */

export type {
  PipelineConcurrencyGroup,
  PipelineId,
  JobState,
  BundleState,
  JobProgressSnapshot,
  JobView,
  BundleView,
  PipelineQueueSnapshot,
  PipelineConcurrencyConfig,
  PipelineLifecycleEvent,
  EnqueueRejection,
} from "../../src/shared/pipeline-types";
export { DEFAULT_PIPELINE_CONCURRENCY } from "../../src/shared/pipeline-types";

import type {
  JobProgressSnapshot,
  PipelineId,
} from "../../src/shared/pipeline-types";

/**
 * Generic progress event emitted by a pipeline runner via the
 * `PipelineContext.report` callback. The scheduler relays these to the
 * renderer over a single typed channel so every pipeline type benefits from
 * the same dock UX. Pipeline-specific richer payloads can ride along in
 * `details`.
 */
export type PipelineProgressEvent =
  | {
      type: "started";
      total?: number;
      message?: string;
      details?: unknown;
    }
  | {
      type: "phase-changed";
      phase: string;
      processed?: number;
      total?: number;
      message?: string;
      details?: unknown;
    }
  | {
      type: "item-updated";
      processed?: number;
      total?: number;
      message?: string;
      details?: unknown;
    }
  | {
      type: "log";
      level: "info" | "warn" | "error";
      message: string;
    };

/**
 * Output shape of a job; intentionally `unknown` to keep the scheduler
 * decoupled from any individual pipeline. Definitions carry their own typed
 * `Output` generic so chained `inputBinding.mapper` stays type-safe at the
 * call site.
 */
export type JobOutput = unknown;

/**
 * Connects the output of an upstream job (within the same bundle) to the
 * params of a downstream job. The scheduler resolves the binding right before
 * starting the downstream job, after the upstream job reaches "succeeded".
 *
 * If the upstream job ends in any non-success state and the binding is marked
 * `requireSuccess` (default true), the downstream job is skipped.
 */
export interface InputBinding<UpstreamOutput = unknown, DownstreamParams = unknown> {
  /** Job ID of the upstream job inside the same bundle. */
  fromJobId: string;
  /** Maps the upstream output into the downstream params. */
  mapper: (upstreamOutput: UpstreamOutput, ctx: { bundleId: string }) => DownstreamParams;
  /** When true (default), skip the downstream job if upstream did not succeed. */
  requireSuccess?: boolean;
}

/**
 * A single queued instance of a pipeline.
 *
 * Use `BundleSpec` (in `pipeline-scheduler.ts`) when enqueuing new bundles —
 * the scheduler fills in the lifecycle/progress fields. This shape is
 * exposed primarily for tests and the scheduler's own snapshots.
 */
export interface Job<Params = unknown, Output = unknown> {
  jobId: string;
  pipelineId: PipelineId;
  params: Params;
  inputBinding?: InputBinding<unknown, Partial<Params>>;
  state: import("../../src/shared/pipeline-types").JobState;
  progress: JobProgressSnapshot;
  output: Output | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

/**
 * An ordered chain of {@link Job}s that the scheduler runs strictly in
 * sequence.
 */
export interface Bundle {
  bundleId: string;
  displayName: string;
  jobs: Job[];
  state: import("../../src/shared/pipeline-types").BundleState;
  enqueuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}
