import { describe, expect, it } from "vitest";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  createPipelineQueueSlice,
  type PipelineQueueSlice,
} from "./pipeline-queue-slice";
import type { PipelineQueueSnapshot } from "../../shared/pipeline-types";

function makeStore() {
  return createStore<PipelineQueueSlice>()(
    immer((...a) => ({
      ...createPipelineQueueSlice(...(a as Parameters<typeof createPipelineQueueSlice>)),
    })),
  );
}

const SAMPLE_SNAPSHOT: PipelineQueueSnapshot = {
  running: [
    {
      bundleId: "b1",
      displayName: "Scan",
      state: "running",
      enqueuedAt: 1,
      startedAt: 2,
      finishedAt: null,
      jobs: [
        {
          jobId: "j1",
          pipelineId: "metadata-scan",
          state: "running",
          progress: {
            phase: "scanning",
            processed: 5,
            total: 100,
            message: "Scanning",
            details: null,
            lastUpdatedAt: 0,
          },
          error: null,
          startedAt: 2,
          finishedAt: null,
        },
      ],
    },
  ],
  queued: [
    {
      bundleId: "b2",
      displayName: "Geocode",
      state: "queued",
      enqueuedAt: 3,
      startedAt: null,
      finishedAt: null,
      jobs: [
        {
          jobId: "j2",
          pipelineId: "gps-geocode",
          state: "pending",
          progress: {
            phase: null,
            processed: 0,
            total: null,
            message: null,
            details: null,
            lastUpdatedAt: 0,
          },
          error: null,
          startedAt: null,
          finishedAt: null,
        },
      ],
    },
  ],
  recent: [],
};

describe("pipelineQueueSlice", () => {
  it("setPipelineQueueSnapshot replaces all three buckets", () => {
    const store = makeStore();
    store.getState().setPipelineQueueSnapshot(SAMPLE_SNAPSHOT);
    expect(store.getState().pipelineRunning).toHaveLength(1);
    expect(store.getState().pipelineQueued).toHaveLength(1);
    expect(store.getState().pipelineRecent).toHaveLength(0);
  });

  it("patchJobProgress updates the matching job's progress in place", () => {
    const store = makeStore();
    store.getState().setPipelineQueueSnapshot(SAMPLE_SNAPSHOT);
    store.getState().patchJobProgress("b1", "j1", {
      phase: "scanning",
      processed: 50,
      total: 100,
      message: "Halfway",
      details: null,
      lastUpdatedAt: 1234,
    });
    const updated = store.getState().pipelineRunning[0]!.jobs[0]!;
    expect(updated.progress.processed).toBe(50);
    expect(updated.progress.message).toBe("Halfway");
  });

  it("patchJobProgress is a no-op for unknown bundle/job ids", () => {
    const store = makeStore();
    store.getState().setPipelineQueueSnapshot(SAMPLE_SNAPSHOT);
    const before = store.getState().pipelineRunning[0]!.jobs[0]!.progress.processed;
    store.getState().patchJobProgress("ghost", "ghost", {
      phase: null,
      processed: 999,
      total: null,
      message: null,
      details: null,
      lastUpdatedAt: 0,
    });
    expect(store.getState().pipelineRunning[0]!.jobs[0]!.progress.processed).toBe(before);
  });

  it("appendPipelineLifecycle prepends and caps the log to 10 entries", () => {
    const store = makeStore();
    for (let i = 0; i < 15; i++) {
      store.getState().appendPipelineLifecycle({
        type: "bundle-queued",
        bundleId: `b${i}`,
        displayName: `Bundle ${i}`,
      });
    }
    const log = store.getState().pipelineLifecycleLog;
    expect(log).toHaveLength(10);
    expect(log[0]).toMatchObject({ bundleId: "b14" });
    expect(log[9]).toMatchObject({ bundleId: "b5" });
  });

  it("clearPipelineLifecycleLog empties the log", () => {
    const store = makeStore();
    store.getState().appendPipelineLifecycle({
      type: "bundle-queued",
      bundleId: "b",
      displayName: "x",
    });
    store.getState().clearPipelineLifecycleLog();
    expect(store.getState().pipelineLifecycleLog).toEqual([]);
  });
});
