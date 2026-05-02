import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineScheduler } from "../pipeline-scheduler";
import { pipelineRegistry } from "../pipeline-registry";
import type {
  PipelineConcurrencyConfig,
  PipelineId,
} from "../../../src/shared/pipeline-types";

/**
 * Helper that registers a deterministic pipeline definition resolving via
 * caller-controlled deferreds. The returned `resolve()` / `reject()` functions
 * advance whatever job is currently running.
 */
function registerControllableDef<Output = unknown>(opts: {
  id: PipelineId;
  group?: "gpu" | "ollama" | "cpu" | "io";
  output?: Output;
  /** Set true to make the runner respect ctx.signal and throw AbortError on abort. */
  cancellable?: boolean;
}): {
  resolve: (output?: Output) => void;
  reject: (err: Error) => void;
  starts: { pipelineId: PipelineId; jobId: string }[];
} {
  const queue: Array<{ resolve: (v: Output) => void; reject: (err: Error) => void }> = [];
  const starts: { pipelineId: PipelineId; jobId: string }[] = [];

  pipelineRegistry.register({
    id: opts.id,
    displayName: opts.id,
    concurrencyGroup: opts.group ?? "cpu",
    run: (ctx) => {
      starts.push({ pipelineId: opts.id, jobId: ctx.jobId });
      return new Promise<Output>((resolve, reject) => {
        queue.push({ resolve, reject });
        if (opts.cancellable !== false) {
          ctx.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }
      });
    },
  });

  return {
    resolve: (output?: Output) => {
      const next = queue.shift();
      if (!next) throw new Error(`No pending invocation for ${opts.id}`);
      next.resolve((output ?? opts.output) as Output);
    },
    reject: (err: Error) => {
      const next = queue.shift();
      if (!next) throw new Error(`No pending invocation for ${opts.id}`);
      next.reject(err);
    },
    starts,
  };
}

describe("PipelineScheduler", () => {
  beforeEach(() => {
    pipelineRegistry.clear();
  });

  afterEach(() => {
    pipelineRegistry.clear();
  });

  it("rejects bundles with unknown pipeline ids", () => {
    const sched = new PipelineScheduler();
    const result = sched.enqueueBundle({
      displayName: "test",
      jobs: [{ pipelineId: "metadata-scan" as PipelineId, params: {} }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.kind).toBe("unknown-pipeline");
    }
  });

  it("starts a single-job bundle and reports succeeded state", async () => {
    const ctrl = registerControllableDef({ id: "metadata-scan", output: { scanned: 3 } });
    const sched = new PipelineScheduler();

    const result = sched.enqueueBundle({
      displayName: "scan",
      jobs: [{ pipelineId: "metadata-scan", params: { folderPath: "/x" } }],
    });
    expect(result.ok).toBe(true);

    // Wait one microtask for the runner to be invoked.
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.starts).toHaveLength(1);

    const snapshotMid = sched.getSnapshot();
    expect(snapshotMid.running).toHaveLength(1);
    expect(snapshotMid.running[0]!.jobs[0]!.state).toBe("running");

    ctrl.resolve();
    await flushMicrotasks();

    const snapshotEnd = sched.getSnapshot();
    expect(snapshotEnd.running).toHaveLength(0);
    expect(snapshotEnd.recent).toHaveLength(1);
    expect(snapshotEnd.recent[0]!.state).toBe("succeeded");
    expect(snapshotEnd.recent[0]!.jobs[0]!.state).toBe("succeeded");
  });

  it("runs jobs within a bundle strictly sequentially", async () => {
    const a = registerControllableDef({ id: "metadata-scan", group: "io" });
    const b = registerControllableDef({ id: "gps-geocode", group: "io" });
    const sched = new PipelineScheduler();

    sched.enqueueBundle({
      displayName: "chain",
      jobs: [
        { jobId: "a", pipelineId: "metadata-scan", params: {} },
        { jobId: "b", pipelineId: "gps-geocode", params: {} },
      ],
    });

    await flushMicrotasks();
    expect(a.starts).toHaveLength(1);
    expect(b.starts).toHaveLength(0);

    a.resolve();
    await flushMicrotasks();
    expect(b.starts).toHaveLength(1);

    b.resolve();
    await flushMicrotasks();
    expect(sched.getSnapshot().recent[0]!.state).toBe("succeeded");
  });

  it("flows output through inputBinding into downstream params", async () => {
    const a = registerControllableDef<{ ids: number[] }>({ id: "metadata-scan" });
    let receivedParams: unknown = null;
    pipelineRegistry.register({
      id: "gps-geocode",
      displayName: "gps-geocode",
      concurrencyGroup: "io",
      run: async (_ctx, params) => {
        receivedParams = params;
        return null;
      },
    });

    const sched = new PipelineScheduler();
    sched.enqueueBundle({
      displayName: "chain",
      jobs: [
        { jobId: "a", pipelineId: "metadata-scan", params: {} },
        {
          jobId: "b",
          pipelineId: "gps-geocode",
          params: { existing: "keep" },
          inputBinding: {
            fromJobId: "a",
            mapper: (out: unknown) => {
              const o = out as { ids: number[] };
              return { mediaItemIds: o.ids };
            },
          },
        },
      ],
    });

    await flushMicrotasks();
    a.resolve({ ids: [10, 20, 30] });
    await flushMicrotasks();

    expect(receivedParams).toEqual({ existing: "keep", mediaItemIds: [10, 20, 30] });
  });

  it("skips downstream job when upstream fails (requireSuccess default)", async () => {
    const a = registerControllableDef({ id: "metadata-scan" });
    let bRan = 0;
    pipelineRegistry.register({
      id: "gps-geocode",
      displayName: "gps-geocode",
      concurrencyGroup: "io",
      run: async () => {
        bRan += 1;
        return null;
      },
    });

    const sched = new PipelineScheduler();
    sched.enqueueBundle({
      displayName: "chain",
      jobs: [
        { jobId: "a", pipelineId: "metadata-scan", params: {} },
        {
          jobId: "b",
          pipelineId: "gps-geocode",
          params: {},
          inputBinding: { fromJobId: "a", mapper: () => ({}) },
        },
      ],
    });

    await flushMicrotasks();
    a.reject(new Error("disk full"));
    await flushMicrotasks();

    expect(bRan).toBe(0);
    const recent = sched.getSnapshot().recent[0]!;
    expect(recent.state).toBe("failed");
    expect(recent.jobs[0]!.state).toBe("failed");
    expect(recent.jobs[1]!.state).toBe("skipped");
  });

  it("respects per-group concurrency limits across bundles", async () => {
    const ollamaCount = { value: 0, max: 0 };
    const trackOllama = () => {
      ollamaCount.value += 1;
      if (ollamaCount.value > ollamaCount.max) ollamaCount.max = ollamaCount.value;
    };
    const releaseOllama = () => {
      ollamaCount.value -= 1;
    };
    const ollamaQueues: Array<{ resolve: () => void }> = [];
    pipelineRegistry.register({
      id: "photo-analysis",
      displayName: "photo-analysis",
      concurrencyGroup: "ollama",
      run: () => {
        trackOllama();
        return new Promise<void>((resolve) => {
          ollamaQueues.push({
            resolve: () => {
              releaseOllama();
              resolve();
            },
          });
        });
      },
    });

    const cfg: PipelineConcurrencyConfig = {
      groupLimits: { gpu: 1, ollama: 1, cpu: 2, io: 2 },
    };
    const sched = new PipelineScheduler(() => cfg);

    sched.enqueueBundle({
      displayName: "b1",
      jobs: [{ pipelineId: "photo-analysis", params: {} }],
    });
    sched.enqueueBundle({
      displayName: "b2",
      jobs: [{ pipelineId: "photo-analysis", params: {} }],
    });
    sched.enqueueBundle({
      displayName: "b3",
      jobs: [{ pipelineId: "photo-analysis", params: {} }],
    });

    await flushMicrotasks();
    expect(ollamaCount.max).toBe(1);
    expect(ollamaQueues).toHaveLength(1);

    ollamaQueues[0]!.resolve();
    await flushMicrotasks();
    expect(ollamaCount.max).toBe(1);
    expect(ollamaQueues).toHaveLength(2);

    ollamaQueues[1]!.resolve();
    await flushMicrotasks();
    ollamaQueues[2]!.resolve();
    await flushMicrotasks();

    expect(sched.getSnapshot().recent).toHaveLength(3);
  });

  it("allows parallel bundles when their jobs are in different concurrency groups", async () => {
    const meta = registerControllableDef({ id: "metadata-scan", group: "io" });
    const photo = registerControllableDef({ id: "photo-analysis", group: "ollama" });
    const sched = new PipelineScheduler();

    sched.enqueueBundle({
      displayName: "io",
      jobs: [{ pipelineId: "metadata-scan", params: {} }],
    });
    sched.enqueueBundle({
      displayName: "ollama",
      jobs: [{ pipelineId: "photo-analysis", params: {} }],
    });

    await flushMicrotasks();
    expect(meta.starts).toHaveLength(1);
    expect(photo.starts).toHaveLength(1);
    meta.resolve();
    photo.resolve();
    await flushMicrotasks();
  });

  it("rejects a duplicate folder job when the same pipeline is already running", async () => {
    registerControllableDef({ id: "photo-analysis", group: "ollama" });
    const sched = new PipelineScheduler();

    const first = sched.enqueueBundle({
      displayName: "first",
      jobs: [{ pipelineId: "photo-analysis", params: { folderPath: "C:/Photos/Trip", recursive: true } }],
    });
    expect(first.ok).toBe(true);
    await flushMicrotasks();

    const duplicate = sched.enqueueBundle({
      displayName: "duplicate",
      jobs: [{ pipelineId: "photo-analysis", params: { folderPath: "C:/Photos/Trip", recursive: true } }],
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.rejection.kind).toBe("duplicate-active-job");
    }
    expect(sched.getSnapshot().running).toHaveLength(1);
    expect(sched.getSnapshot().queued).toHaveLength(0);
  });

  it("rejects a subfolder job covered by an already queued recursive job for the same pipeline", async () => {
    registerControllableDef({ id: "semantic-index", group: "ollama" });
    registerControllableDef({ id: "photo-analysis", group: "ollama" });
    const sched = new PipelineScheduler();

    sched.enqueueBundle({
      displayName: "blocker",
      jobs: [{ pipelineId: "semantic-index", params: { folderPath: "C:/Other", recursive: true } }],
    });
    const parent = sched.enqueueBundle({
      displayName: "parent",
      jobs: [{ pipelineId: "photo-analysis", params: { folderPath: "C:/Photos", recursive: true } }],
    });
    expect(parent.ok).toBe(true);
    await flushMicrotasks();
    expect(sched.getSnapshot().queued).toHaveLength(1);

    const child = sched.enqueueBundle({
      displayName: "child",
      jobs: [{ pipelineId: "photo-analysis", params: { folderPath: "C:/Photos/Trip", recursive: true } }],
    });

    expect(child.ok).toBe(false);
    if (!child.ok) {
      if (child.rejection.kind !== "duplicate-active-job") {
        throw new Error(`expected duplicate-active-job, got ${child.rejection.kind}`);
      }
      expect(child.rejection.existingFolderPath).toBe("C:/Photos");
    }
    expect(sched.getSnapshot().queued).toHaveLength(1);
  });

  it("cancels a running bundle and aborts its job", async () => {
    let aborted = false;
    pipelineRegistry.register({
      id: "metadata-scan",
      displayName: "metadata-scan",
      concurrencyGroup: "io",
      run: (ctx) =>
        new Promise<void>((_resolve, reject) => {
          ctx.signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    });

    const sched = new PipelineScheduler();
    const result = sched.enqueueBundle({
      displayName: "scan",
      jobs: [{ pipelineId: "metadata-scan", params: {} }],
    });
    if (!result.ok) throw new Error("expected ok");

    await flushMicrotasks();
    sched.cancelBundle(result.bundleId);
    await flushMicrotasks();

    expect(aborted).toBe(true);
    const recent = sched.getSnapshot().recent[0]!;
    expect(recent.state).toBe("cancelled");
    expect(recent.jobs[0]!.state).toBe("cancelled");
  });

  it("removes a queued (not-yet-started) bundle from the queue", async () => {
    pipelineRegistry.register({
      id: "metadata-scan",
      displayName: "metadata-scan",
      concurrencyGroup: "ollama",
      run: () => new Promise<void>(() => undefined),
    });
    pipelineRegistry.register({
      id: "photo-analysis",
      displayName: "photo-analysis",
      concurrencyGroup: "ollama",
      run: () => new Promise<void>(() => undefined),
    });

    const sched = new PipelineScheduler();
    sched.enqueueBundle({
      displayName: "first",
      jobs: [{ pipelineId: "metadata-scan", params: {} }],
    });
    const second = sched.enqueueBundle({
      displayName: "second",
      jobs: [{ pipelineId: "photo-analysis", params: {} }],
    });
    if (!second.ok) throw new Error("expected ok");

    await flushMicrotasks();
    expect(sched.getSnapshot().queued).toHaveLength(1);
    const removed = sched.removeQueued(second.bundleId);
    expect(removed).toBe(true);
    expect(sched.getSnapshot().queued).toHaveLength(0);
    expect(sched.getSnapshot().recent.find((b) => b.bundleId === second.bundleId)?.state).toBe(
      "cancelled",
    );
  });

  it("emits queue-changed events on each transition", async () => {
    const ctrl = registerControllableDef({ id: "metadata-scan" });
    const sched = new PipelineScheduler();
    const observed = vi.fn();
    sched.on("queue-changed", observed);
    sched.enqueueBundle({
      displayName: "scan",
      jobs: [{ pipelineId: "metadata-scan", params: {} }],
    });
    await flushMicrotasks();
    ctrl.resolve();
    await flushMicrotasks();
    expect(observed).toHaveBeenCalled();
    expect(observed.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects forward references in inputBinding.fromJobId", () => {
    pipelineRegistry.register({
      id: "metadata-scan",
      displayName: "x",
      concurrencyGroup: "io",
      run: async () => null,
    });
    const sched = new PipelineScheduler();
    const result = sched.enqueueBundle({
      displayName: "bad",
      jobs: [
        {
          jobId: "first",
          pipelineId: "metadata-scan",
          params: {},
          inputBinding: { fromJobId: "second", mapper: () => ({}) },
        },
        { jobId: "second", pipelineId: "metadata-scan", params: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection.kind).toBe("invalid-binding");
    }
  });

  it("propagates progress reports into the per-job snapshot", async () => {
    const ctrl = registerControllableDef({ id: "metadata-scan" });
    pipelineRegistry.clear();
    let captured: import("../pipeline-context").PipelineContext | null = null;
    pipelineRegistry.register({
      id: "metadata-scan",
      displayName: "metadata-scan",
      concurrencyGroup: "io",
      run: (ctx) => {
        captured = ctx;
        return new Promise<void>(() => undefined);
      },
    });
    const sched = new PipelineScheduler();
    sched.enqueueBundle({
      displayName: "scan",
      jobs: [{ pipelineId: "metadata-scan", params: {} }],
    });
    await flushMicrotasks();

    captured!.report({ type: "phase-changed", phase: "scanning", processed: 5, total: 100 });
    captured!.report({ type: "item-updated", processed: 50, total: 100, message: "halfway" });

    const snap = sched.getSnapshot().running[0]!.jobs[0]!.progress;
    expect(snap.phase).toBe("scanning");
    expect(snap.processed).toBe(50);
    expect(snap.total).toBe(100);
    expect(snap.message).toBe("halfway");
    void ctrl;
  });
});

/**
 * Flushes a couple of microtask turns so chained `.then()` reactions inside
 * the scheduler's job-completion hooks all settle before assertions run.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}
