import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import type { PipelineContext } from "./pipeline-context";
import {
  pipelineRegistry,
  type AnyPipelineDefinition,
} from "./pipeline-registry";
import {
  DEFAULT_PIPELINE_CONCURRENCY,
  type Bundle,
  type BundleState,
  type BundleView,
  type EnqueueRejection,
  type InputBinding,
  type Job,
  type JobOutput,
  type JobProgressSnapshot,
  type JobState,
  type JobView,
  type PipelineConcurrencyConfig,
  type PipelineConcurrencyGroup,
  type PipelineId,
  type PipelineLifecycleEvent,
  type PipelineProgressEvent,
  type PipelineQueueSnapshot,
} from "./pipeline-types";

/**
 * Maximum number of recently-finished bundles kept in the snapshot for the
 * dock to display. Older entries are dropped.
 */
const RECENT_BUNDLES_LIMIT = 20;

/**
 * Internal record bookkeeping for a job that is currently running. The
 * scheduler owns the AbortController and listens for completion. Stored
 * separately from the {@link Job} so test/debug snapshots stay free of
 * Node-only handles.
 */
interface RunningJobRecord {
  bundle: Bundle;
  job: Job;
  abortController: AbortController;
  /** Group used to count this job against the per-group cap. */
  group: PipelineConcurrencyGroup;
}

/**
 * Optional input describing a job to enqueue. Identical to {@link Job} but
 * with the lifecycle/progress fields elided — the scheduler fills those in.
 *
 * Use the explicit `jobId` field to give a job a stable id (useful for
 * downstream `inputBinding.fromJobId` references). When omitted, the
 * scheduler assigns a fresh UUID.
 */
export interface JobSpec<Params = unknown, Output = unknown> {
  jobId?: string;
  pipelineId: PipelineId;
  params: Params;
  inputBinding?: InputBinding<unknown, Partial<Params>>;
  output?: Output | null;
}

/**
 * Optional input describing a bundle to enqueue. Bundles are constructed via
 * {@link PipelineScheduler.enqueueBundle}.
 */
export interface BundleSpec {
  bundleId?: string;
  displayName: string;
  jobs: JobSpec[];
  /** Optional renderer window forwarded to each job's PipelineContext. */
  originatorWindow?: BrowserWindow;
}

/**
 * Result of {@link PipelineScheduler.enqueueBundle}: either the accepted bundle
 * id or a structured rejection that the caller can surface to the UI / IPC.
 */
export type EnqueueResult =
  | { ok: true; bundleId: string }
  | { ok: false; rejection: EnqueueRejection };

/**
 * Scheduler events. Strongly typed so listeners and IPC layers stay aligned.
 */
export type SchedulerEventMap = {
  "queue-changed": [PipelineQueueSnapshot];
  "lifecycle": [PipelineLifecycleEvent];
  "job-progress": [
    {
      bundleId: string;
      jobId: string;
      pipelineId: PipelineId;
      progress: JobProgressSnapshot;
    },
  ];
};

/**
 * In-memory pipeline scheduler.
 *
 * Holds a FIFO list of enqueued bundles and a small set of currently running
 * jobs. Jobs within a bundle run strictly sequentially; jobs from different
 * bundles may run in parallel as long as concurrency-group caps permit.
 *
 * The scheduler is intentionally framework-agnostic — it only knows about
 * pipeline definitions and concurrency configuration. IPC integration lives in
 * `pipeline-orchestration-handlers.ts`.
 */
export class PipelineScheduler {
  private readonly emitter = new EventEmitter();
  /** Bundles in queued or running state, in original FIFO order. */
  private readonly active: Bundle[] = [];
  /** Bundles in a terminal state, capped to {@link RECENT_BUNDLES_LIMIT}. */
  private readonly recent: Bundle[] = [];
  private readonly running = new Map<string, RunningJobRecord>();
  private readonly originatorByBundle = new Map<string, BrowserWindow>();
  /** Reads current concurrency config; called every time we attempt to schedule. */
  private readonly getConcurrency: () => PipelineConcurrencyConfig;

  /**
   * @param getConcurrency Called at scheduling decision time. The default
   *   returns {@link DEFAULT_PIPELINE_CONCURRENCY}. Phase 6 wires this to
   *   `pipelineConcurrency` from `media-settings.json`.
   */
  constructor(
    getConcurrency: () => PipelineConcurrencyConfig = () => DEFAULT_PIPELINE_CONCURRENCY,
  ) {
    this.getConcurrency = getConcurrency;
  }

  on<K extends keyof SchedulerEventMap>(
    event: K,
    listener: (...args: SchedulerEventMap[K]) => void,
  ): () => void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return () => this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Enqueue a bundle. Validates each job's pipeline id and (when provided)
   * params. Returns the bundle id on success or a structured rejection.
   *
   * Side effects on success:
   *   - The bundle is appended to the queue (FIFO).
   *   - "queue-changed" + "lifecycle:bundle-queued" events are emitted.
   *   - Scheduling is attempted immediately.
   */
  enqueueBundle(spec: BundleSpec): EnqueueResult {
    const bundle = this.buildBundle(spec);
    if (!bundle.ok) {
      return { ok: false, rejection: bundle.rejection };
    }

    this.active.push(bundle.bundle);
    if (spec.originatorWindow) {
      this.originatorByBundle.set(bundle.bundle.bundleId, spec.originatorWindow);
    }

    this.emitLifecycle({
      type: "bundle-queued",
      bundleId: bundle.bundle.bundleId,
      displayName: bundle.bundle.displayName,
    });
    this.emitQueueChanged();
    this.tick();

    return { ok: true, bundleId: bundle.bundle.bundleId };
  }

  /**
   * Cancel a bundle. Aborts any currently-running job in the bundle, marks
   * remaining queued jobs as cancelled, and removes the bundle from the active
   * list (it appears in `recent` afterwards).
   *
   * Returns true if the bundle existed and is now cancelled (or already in a
   * terminal state); false if no such bundle exists.
   */
  cancelBundle(bundleId: string): boolean {
    const bundle = this.active.find((b) => b.bundleId === bundleId);
    if (!bundle) {
      return this.recent.some((b) => b.bundleId === bundleId);
    }
    for (const job of bundle.jobs) {
      if (job.state === "pending") {
        job.state = "cancelled";
        job.finishedAt = Date.now();
      } else if (job.state === "running") {
        const record = this.running.get(job.jobId);
        if (record) {
          record.abortController.abort();
        }
      }
    }
    if (bundle.state === "queued") {
      this.markBundleTerminal(bundle, "cancelled");
    } else {
      // Running bundle's running job will resolve (likely as cancelled) and
      // tick() will then progress to terminal via aggregateBundleState().
    }
    this.emitQueueChanged();
    this.tick();
    return true;
  }

  /**
   * Cancel a single job. If the job is running, its AbortSignal fires; if
   * pending, it transitions to "cancelled" immediately. Subsequent jobs in
   * the same bundle whose `inputBinding.requireSuccess` is true will be
   * skipped during the next scheduling pass.
   */
  cancelJob(jobId: string): boolean {
    for (const bundle of this.active) {
      const job = bundle.jobs.find((j) => j.jobId === jobId);
      if (!job) continue;
      if (job.state === "pending") {
        job.state = "cancelled";
        job.finishedAt = Date.now();
        this.emitLifecycle({
          type: "job-finished",
          bundleId: bundle.bundleId,
          jobId: job.jobId,
          pipelineId: job.pipelineId,
          state: "cancelled",
          error: null,
        });
        this.emitQueueChanged();
        this.tick();
        return true;
      }
      if (job.state === "running") {
        const record = this.running.get(jobId);
        record?.abortController.abort();
        return true;
      }
    }
    return false;
  }

  /**
   * Remove a fully-queued bundle from the queue without starting it. If any
   * job in the bundle is already running, this falls back to
   * {@link cancelBundle}. Returns true if removal/cancellation happened.
   */
  removeQueued(bundleId: string): boolean {
    const idx = this.active.findIndex((b) => b.bundleId === bundleId);
    if (idx < 0) return false;
    const bundle = this.active[idx]!;
    if (bundle.state === "running") {
      return this.cancelBundle(bundleId);
    }
    this.active.splice(idx, 1);
    this.originatorByBundle.delete(bundleId);
    bundle.state = "cancelled";
    bundle.finishedAt = Date.now();
    this.pushRecent(bundle);
    this.emitLifecycle({ type: "bundle-finished", bundleId, state: "cancelled" });
    this.emitQueueChanged();
    return true;
  }

  /**
   * Cancel all bundles. Currently-running jobs receive an abort; queued
   * bundles are removed.
   */
  clearQueue(): void {
    const ids = [...this.active.map((b) => b.bundleId)];
    for (const id of ids) {
      this.cancelBundle(id);
    }
  }

  /**
   * Snapshot of the queue state, suitable for IPC payloads or initial UI
   * hydration. Always returns deep copies of view objects so callers can not
   * accidentally mutate scheduler internals.
   */
  getSnapshot(): PipelineQueueSnapshot {
    const running: BundleView[] = [];
    const queued: BundleView[] = [];
    for (const bundle of this.active) {
      const view = toBundleView(bundle);
      if (bundle.state === "running") {
        running.push(view);
      } else {
        queued.push(view);
      }
    }
    const recent = this.recent.map(toBundleView);
    return { running, queued, recent };
  }

  // -----------------------------------------------------------------------
  // Bundle construction & validation
  // -----------------------------------------------------------------------

  private buildBundle(
    spec: BundleSpec,
  ): { ok: true; bundle: Bundle } | { ok: false; rejection: EnqueueRejection } {
    const bundleId = spec.bundleId ?? randomUUID();
    const seenJobIds = new Set<string>();
    const jobs: Job[] = [];

    for (const jobSpec of spec.jobs) {
      const def = pipelineRegistry.get(jobSpec.pipelineId);
      if (!def) {
        return {
          ok: false,
          rejection: { kind: "unknown-pipeline", pipelineId: jobSpec.pipelineId },
        };
      }

      const jobId = jobSpec.jobId ?? randomUUID();
      if (seenJobIds.has(jobId)) {
        return {
          ok: false,
          rejection: {
            kind: "invalid-binding",
            bundleId,
            jobId,
            reason: `Duplicate jobId "${jobId}" within bundle`,
          },
        };
      }
      seenJobIds.add(jobId);

      const initialParams = mergeParams(def.defaultParams, jobSpec.params);
      // Defer params validation until run-time when an inputBinding will mutate
      // params. With no binding, we validate now to fail fast on bad inputs.
      if (!jobSpec.inputBinding && def.validateParams) {
        const result = def.validateParams(initialParams);
        if (!result.ok) {
          return {
            ok: false,
            rejection: {
              kind: "validation-failed",
              jobId,
              pipelineId: jobSpec.pipelineId,
              issues: result.issues,
            },
          };
        }
      }

      jobs.push({
        jobId,
        pipelineId: jobSpec.pipelineId,
        params: initialParams,
        inputBinding: jobSpec.inputBinding,
        state: "pending",
        progress: emptyProgress(),
        output: jobSpec.output ?? null,
        error: null,
        startedAt: null,
        finishedAt: null,
      });
    }

    // Validate `inputBinding.fromJobId` refers to an earlier job in the bundle.
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      if (!job.inputBinding) continue;
      const upstreamIndex = jobs.findIndex((j) => j.jobId === job.inputBinding!.fromJobId);
      if (upstreamIndex < 0 || upstreamIndex >= i) {
        return {
          ok: false,
          rejection: {
            kind: "invalid-binding",
            bundleId,
            jobId: job.jobId,
            reason: `inputBinding.fromJobId="${job.inputBinding.fromJobId}" must reference an earlier job within the same bundle`,
          },
        };
      }
    }

    const bundle: Bundle = {
      bundleId,
      displayName: spec.displayName,
      jobs,
      state: "queued",
      enqueuedAt: Date.now(),
      startedAt: null,
      finishedAt: null,
    };
    return { ok: true, bundle };
  }

  // -----------------------------------------------------------------------
  // Scheduling loop
  // -----------------------------------------------------------------------

  /**
   * Attempts to start as many pending jobs as concurrency caps permit. Called
   * after every scheduler-relevant event (enqueue, job finished, settings
   * changed, etc.).
   *
   * Algorithm:
   *   For each active bundle in FIFO order:
   *     - If the bundle has no current pending job (because all done or a
   *       running job is already in-flight), skip.
   *     - Otherwise check the next-in-line job. If its concurrency group has
   *       capacity, start it; bookkeeping updates `running` and emits events.
   */
  private tick(): void {
    let scheduledSomething = true;
    // Loop until a full pass produces no new starts; this lets newly skipped
    // jobs cascade-skip in a single tick.
    while (scheduledSomething) {
      scheduledSomething = false;
      for (const bundle of this.active) {
        if (bundle.state !== "queued" && bundle.state !== "running") continue;

        const nextJobIndex = bundle.jobs.findIndex(
          (j) => j.state !== "succeeded" && j.state !== "failed" && j.state !== "cancelled" && j.state !== "skipped",
        );
        if (nextJobIndex < 0) {
          // All jobs terminal → bundle should be finalised
          this.finaliseBundleIfNeeded(bundle);
          continue;
        }

        const job = bundle.jobs[nextJobIndex]!;
        if (job.state === "running") continue; // another tick will retry

        if (this.shouldSkipDueToBinding(bundle, job)) {
          job.state = "skipped";
          job.finishedAt = Date.now();
          this.emitLifecycle({
            type: "job-finished",
            bundleId: bundle.bundleId,
            jobId: job.jobId,
            pipelineId: job.pipelineId,
            state: "skipped",
            error: null,
          });
          scheduledSomething = true;
          continue;
        }

        const def = pipelineRegistry.get(job.pipelineId);
        if (!def) {
          job.state = "failed";
          job.error = `Pipeline definition for "${job.pipelineId}" disappeared from registry`;
          job.finishedAt = Date.now();
          this.emitLifecycle({
            type: "job-finished",
            bundleId: bundle.bundleId,
            jobId: job.jobId,
            pipelineId: job.pipelineId,
            state: "failed",
            error: job.error,
          });
          scheduledSomething = true;
          continue;
        }

        const group = this.resolveGroup(def);
        if (!this.hasGroupCapacity(group)) continue;

        // Resolve input binding right before run.
        if (job.inputBinding) {
          const upstream = bundle.jobs.find((j) => j.jobId === job.inputBinding!.fromJobId);
          if (!upstream || upstream.state !== "succeeded") {
            // Should have been caught by shouldSkipDueToBinding above; defensive.
            continue;
          }
          try {
            const mapped = job.inputBinding.mapper(upstream.output, { bundleId: bundle.bundleId });
            job.params = mergeParams(job.params as Record<string, unknown>, mapped);
          } catch (err) {
            job.state = "failed";
            job.error = `inputBinding.mapper threw: ${stringifyError(err)}`;
            job.finishedAt = Date.now();
            this.emitLifecycle({
              type: "job-finished",
              bundleId: bundle.bundleId,
              jobId: job.jobId,
              pipelineId: job.pipelineId,
              state: "failed",
              error: job.error,
            });
            scheduledSomething = true;
            continue;
          }
          if (def.validateParams) {
            const result = def.validateParams(job.params);
            if (!result.ok) {
              job.state = "failed";
              job.error = `Validation failed after binding: ${result.issues}`;
              job.finishedAt = Date.now();
              this.emitLifecycle({
                type: "job-finished",
                bundleId: bundle.bundleId,
                jobId: job.jobId,
                pipelineId: job.pipelineId,
                state: "failed",
                error: job.error,
              });
              scheduledSomething = true;
              continue;
            }
          }
        }

        this.startJob(bundle, job, def, group);
        scheduledSomething = true;
      }
    }
  }

  private shouldSkipDueToBinding(bundle: Bundle, job: Job): boolean {
    if (!job.inputBinding) return false;
    const requireSuccess = job.inputBinding.requireSuccess !== false;
    if (!requireSuccess) return false;
    const upstream = bundle.jobs.find((j) => j.jobId === job.inputBinding!.fromJobId);
    if (!upstream) return true; // shouldn't happen post-validation
    return (
      upstream.state === "failed" ||
      upstream.state === "cancelled" ||
      upstream.state === "skipped"
    );
  }

  private resolveGroup(def: AnyPipelineDefinition): PipelineConcurrencyGroup {
    const cfg = this.getConcurrency();
    const override = cfg.perPipelineGroupOverride?.[def.id];
    return override ?? def.concurrencyGroup;
  }

  private hasGroupCapacity(group: PipelineConcurrencyGroup): boolean {
    const cfg = this.getConcurrency();
    const limit = cfg.groupLimits[group] ?? DEFAULT_PIPELINE_CONCURRENCY.groupLimits[group];
    let inUse = 0;
    for (const record of this.running.values()) {
      if (record.group === group) inUse += 1;
    }
    return inUse < Math.max(1, limit);
  }

  private startJob(
    bundle: Bundle,
    job: Job,
    def: AnyPipelineDefinition,
    group: PipelineConcurrencyGroup,
  ): void {
    const abortController = new AbortController();
    const ctx: PipelineContext = {
      bundleId: bundle.bundleId,
      jobId: job.jobId,
      pipelineId: job.pipelineId,
      bundleDisplayName: bundle.displayName,
      signal: abortController.signal,
      report: (event) => this.handleProgress(bundle, job, event),
      originatorWindow: this.originatorByBundle.get(bundle.bundleId),
    };

    job.state = "running";
    job.startedAt = Date.now();
    if (bundle.state === "queued") {
      bundle.state = "running";
      bundle.startedAt = job.startedAt;
      this.emitLifecycle({ type: "bundle-started", bundleId: bundle.bundleId });
    }
    this.running.set(job.jobId, { bundle, job, abortController, group });
    this.emitLifecycle({
      type: "job-started",
      bundleId: bundle.bundleId,
      jobId: job.jobId,
      pipelineId: job.pipelineId,
    });
    this.emitQueueChanged();

    void Promise.resolve()
      .then(() => def.run(ctx, job.params))
      .then(
        (output: JobOutput) => {
          if (abortController.signal.aborted) {
            this.finishJob(job, "cancelled", null, null);
          } else {
            this.finishJob(job, "succeeded", output, null);
          }
        },
        (err: unknown) => {
          if (abortController.signal.aborted) {
            this.finishJob(job, "cancelled", null, null);
          } else {
            this.finishJob(job, "failed", null, stringifyError(err));
          }
        },
      );
  }

  private handleProgress(bundle: Bundle, job: Job, event: PipelineProgressEvent): void {
    const snapshot = job.progress;
    snapshot.lastUpdatedAt = Date.now();
    switch (event.type) {
      case "started":
        if (event.total !== undefined) snapshot.total = event.total;
        if (event.message !== undefined) snapshot.message = event.message;
        break;
      case "phase-changed":
        snapshot.phase = event.phase;
        if (event.processed !== undefined) snapshot.processed = event.processed;
        if (event.total !== undefined) snapshot.total = event.total;
        if (event.message !== undefined) snapshot.message = event.message;
        break;
      case "item-updated":
        if (event.processed !== undefined) snapshot.processed = event.processed;
        if (event.total !== undefined) snapshot.total = event.total;
        if (event.message !== undefined) snapshot.message = event.message;
        if (event.details !== undefined) snapshot.details = event.details;
        break;
      case "log":
        // Logs are surfaced to listeners but do not mutate the snapshot.
        break;
    }
    this.emitter.emit("job-progress", {
      bundleId: bundle.bundleId,
      jobId: job.jobId,
      pipelineId: job.pipelineId,
      progress: { ...snapshot },
    });
  }

  private finishJob(
    job: Job,
    state: Exclude<JobState, "pending" | "running">,
    output: JobOutput | null,
    error: string | null,
  ): void {
    const record = this.running.get(job.jobId);
    if (!record) return;
    this.running.delete(job.jobId);
    job.state = state;
    job.output = output;
    job.error = error;
    job.finishedAt = Date.now();
    this.emitLifecycle({
      type: "job-finished",
      bundleId: record.bundle.bundleId,
      jobId: job.jobId,
      pipelineId: job.pipelineId,
      state,
      error,
    });
    this.finaliseBundleIfNeeded(record.bundle);
    this.emitQueueChanged();
    this.tick();
  }

  private finaliseBundleIfNeeded(bundle: Bundle): void {
    const allTerminal = bundle.jobs.every(
      (j) =>
        j.state === "succeeded" ||
        j.state === "failed" ||
        j.state === "cancelled" ||
        j.state === "skipped",
    );
    if (!allTerminal) return;
    if (bundle.state === "succeeded" || bundle.state === "failed" || bundle.state === "cancelled" || bundle.state === "partial") {
      // already finalised
      return;
    }
    this.markBundleTerminal(bundle, aggregateBundleState(bundle));
  }

  private markBundleTerminal(bundle: Bundle, state: BundleState): void {
    bundle.state = state;
    bundle.finishedAt = Date.now();
    const idx = this.active.indexOf(bundle);
    if (idx >= 0) this.active.splice(idx, 1);
    this.originatorByBundle.delete(bundle.bundleId);
    this.pushRecent(bundle);
    this.emitLifecycle({ type: "bundle-finished", bundleId: bundle.bundleId, state });
  }

  private pushRecent(bundle: Bundle): void {
    this.recent.unshift(bundle);
    if (this.recent.length > RECENT_BUNDLES_LIMIT) {
      this.recent.length = RECENT_BUNDLES_LIMIT;
    }
  }

  private emitLifecycle(event: PipelineLifecycleEvent): void {
    this.emitter.emit("lifecycle", event);
  }

  private emitQueueChanged(): void {
    this.emitter.emit("queue-changed", this.getSnapshot());
  }
}

import { getCurrentPipelineConcurrency } from "./concurrency-config";

/**
 * Singleton scheduler instance for the main process. Reads the latest
 * pipeline concurrency config on every scheduling decision so changes saved
 * via Desktop Settings take effect on the next scheduling pass without an
 * app restart.
 *
 * Tests should construct their own {@link PipelineScheduler} with a custom
 * getter rather than mutating the singleton.
 */
export const pipelineScheduler = new PipelineScheduler(() => getCurrentPipelineConcurrency());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyProgress(): JobProgressSnapshot {
  return {
    phase: null,
    processed: 0,
    total: null,
    message: null,
    details: null,
    lastUpdatedAt: 0,
  };
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function mergeParams<T>(defaults: Partial<T> | undefined, supplied: T | Partial<T>): T {
  if (defaults === undefined) return supplied as T;
  return { ...(defaults as object), ...(supplied as object) } as T;
}

function aggregateBundleState(bundle: Bundle): BundleState {
  let succeededCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let skippedCount = 0;
  for (const job of bundle.jobs) {
    if (job.state === "succeeded") succeededCount += 1;
    else if (job.state === "failed") failedCount += 1;
    else if (job.state === "cancelled") cancelledCount += 1;
    else if (job.state === "skipped") skippedCount += 1;
  }
  if (cancelledCount > 0 && succeededCount === 0 && failedCount === 0) return "cancelled";
  if (failedCount > 0 && succeededCount === 0) return "failed";
  if (succeededCount === bundle.jobs.length) return "succeeded";
  // Mix of outcomes (e.g. some succeeded, some failed/skipped/cancelled).
  return "partial";
}

function toJobView(job: Job): JobView {
  return {
    jobId: job.jobId,
    pipelineId: job.pipelineId,
    state: job.state,
    progress: { ...job.progress },
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function toBundleView(bundle: Bundle): BundleView {
  return {
    bundleId: bundle.bundleId,
    displayName: bundle.displayName,
    state: bundle.state,
    jobs: bundle.jobs.map(toJobView),
    enqueuedAt: bundle.enqueuedAt,
    startedAt: bundle.startedAt,
    finishedAt: bundle.finishedAt,
  };
}
