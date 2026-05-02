import { describe, expect, it } from "vitest";
import type { BundleView, JobView, PipelineQueueSnapshot } from "../../shared/pipeline-types";
import { createDesktopStore } from "../stores/desktop-store";
import { syncSummaryPipelineCompletionsFromQueueSnapshot } from "./use-pipeline-queue-binding";

function job(overrides: Partial<JobView> & Pick<JobView, "jobId" | "pipelineId" | "state" | "params">): JobView {
  return {
    progress: {
      phase: null,
      processed: 0,
      total: null,
      message: null,
      details: null,
      lastUpdatedAt: Date.parse("2026-05-01T12:00:00.000Z"),
    },
    error: null,
    startedAt: Date.parse("2026-05-01T12:00:00.000Z"),
    finishedAt: Date.parse("2026-05-01T12:01:00.000Z"),
    ...overrides,
  };
}

function snapshotWithRecentJob(recentJob: JobView): PipelineQueueSnapshot {
  const bundle: BundleView = {
    bundleId: "bundle-1",
    displayName: "Test bundle",
    state: recentJob.state === "succeeded" ? "succeeded" : "failed",
    jobs: [recentJob],
    enqueuedAt: Date.parse("2026-05-01T11:59:00.000Z"),
    startedAt: Date.parse("2026-05-01T12:00:00.000Z"),
    finishedAt: Date.parse("2026-05-01T12:01:00.000Z"),
  };
  return { running: [], queued: [], recent: [bundle] };
}

describe("syncSummaryPipelineCompletionsFromQueueSnapshot", () => {
  it("publishes a completion signal for a queued rotation pipeline without running real AI", () => {
    const store = createDesktopStore();
    const seenJobIds = new Set<string>();

    syncSummaryPipelineCompletionsFromQueueSnapshot(
      store,
      snapshotWithRecentJob(
        job({
          jobId: "rotation-job",
          pipelineId: "image-rotation-precheck",
          state: "succeeded",
          params: { folderPath: "C:\\photos\\trip", recursive: true },
        }),
      ),
      seenJobIds,
    );

    expect(store.getState().lastAiPipelineCompletion).toEqual({
      jobId: "rotation-job",
      folderPath: "C:\\photos\\trip",
      kind: "rotation",
      completedAt: "2026-05-01T12:01:00.000Z",
    });
  });

  it("publishes a completion signal for path LLM analysis so folder summaries refresh", () => {
    const store = createDesktopStore();
    const seenJobIds = new Set<string>();

    syncSummaryPipelineCompletionsFromQueueSnapshot(
      store,
      snapshotWithRecentJob(
        job({
          jobId: "path-llm-job",
          pipelineId: "path-llm-analysis",
          state: "succeeded",
          params: { folderPath: "C:\\photos\\trip", recursive: true },
        }),
      ),
      seenJobIds,
    );

    expect(store.getState().lastAiPipelineCompletion).toEqual({
      jobId: "path-llm-job",
      folderPath: "C:\\photos\\trip",
      kind: "path-llm",
      completedAt: "2026-05-01T12:01:00.000Z",
    });
  });

  it("does not publish duplicate completion signals for repeated queue snapshots", () => {
    const store = createDesktopStore();
    const seenJobIds = new Set<string>();
    const snapshot = snapshotWithRecentJob(
      job({
        jobId: "face-job",
        pipelineId: "face-detection",
        state: "succeeded",
        params: { folderPath: "C:\\photos", recursive: true },
      }),
    );

    syncSummaryPipelineCompletionsFromQueueSnapshot(store, snapshot, seenJobIds);
    const firstSignal = store.getState().lastAiPipelineCompletion;
    store.getState().setLastAiPipelineCompletion({
      jobId: "sentinel",
      folderPath: "C:\\other",
      kind: "photo",
      completedAt: "2026-05-01T13:00:00.000Z",
    });
    syncSummaryPipelineCompletionsFromQueueSnapshot(store, snapshot, seenJobIds);

    expect(firstSignal?.jobId).toBe("face-job");
    expect(store.getState().lastAiPipelineCompletion?.jobId).toBe("sentinel");
  });

  it("publishes completion signal for cancelled summary job when some files were processed", () => {
    const store = createDesktopStore();
    const seenJobIds = new Set<string>();

    syncSummaryPipelineCompletionsFromQueueSnapshot(
      store,
      snapshotWithRecentJob(
        job({
          jobId: "semantic-cancelled-job",
          pipelineId: "semantic-index",
          state: "cancelled",
          params: { folderPath: "C:\\photos\\trip", recursive: true },
          progress: {
            phase: "indexing",
            processed: 12,
            total: 20,
            message: "Cancelled by user",
            details: null,
            lastUpdatedAt: Date.parse("2026-05-01T12:00:00.000Z"),
          },
        }),
      ),
      seenJobIds,
    );

    expect(store.getState().lastAiPipelineCompletion).toEqual({
      jobId: "semantic-cancelled-job",
      folderPath: "C:\\photos\\trip",
      kind: "semantic",
      completedAt: "2026-05-01T12:01:00.000Z",
    });
  });

  it("ignores cancelled summary job when nothing was processed", () => {
    const store = createDesktopStore();
    const seenJobIds = new Set<string>();

    syncSummaryPipelineCompletionsFromQueueSnapshot(
      store,
      snapshotWithRecentJob(
        job({
          jobId: "face-cancelled-empty",
          pipelineId: "face-detection",
          state: "cancelled",
          params: { folderPath: "C:\\photos\\trip", recursive: true },
          progress: {
            phase: "queued",
            processed: 0,
            total: 20,
            message: "Cancelled before start",
            details: null,
            lastUpdatedAt: Date.parse("2026-05-01T12:00:00.000Z"),
          },
        }),
      ),
      seenJobIds,
    );

    expect(store.getState().lastAiPipelineCompletion).toBeNull();
  });
});
