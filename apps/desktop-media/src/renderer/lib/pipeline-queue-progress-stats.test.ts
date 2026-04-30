import { describe, expect, it } from "vitest";
import type { JobView, PipelineId } from "../../shared/pipeline-types";
import { buildPipelineQueueRightText, buildPipelineQueueStatsText } from "./pipeline-queue-progress-stats";

function jobView(overrides: {
  pipelineId: PipelineId;
  processed: number;
  total: number;
  details?: unknown;
  state?: JobView["state"];
}): JobView {
  return {
    jobId: "job-1",
    pipelineId: overrides.pipelineId,
    params: {},
    state: overrides.state ?? "running",
    error: null,
    startedAt: 1,
    finishedAt: null,
    progress: {
      phase: null,
      processed: overrides.processed,
      total: overrides.total,
      message: null,
      details: overrides.details ?? null,
      lastUpdatedAt: 1,
    },
  };
}

describe("buildPipelineQueueStatsText", () => {
  it("formats processed count with spaced ratio and hides zero skipped and failed", () => {
    expect(
      buildPipelineQueueStatsText(
        jobView({
          pipelineId: "photo-analysis",
          processed: 2,
          total: 10,
        }),
      ),
    ).toBe("Processed: 2 / 10");
  });

  it("shows skipped only when items were previously processed outside this run", () => {
    expect(
      buildPipelineQueueStatsText(
        jobView({
          pipelineId: "semantic-index",
          processed: 2,
          total: 10,
          details: { skipped: 90 },
        }),
      ),
    ).toBe("Processed: 2 / 10 | Skipped: 90");
  });

  it("shows skipped from start even when processed is zero", () => {
    expect(
      buildPipelineQueueStatsText(
        jobView({
          pipelineId: "semantic-index",
          processed: 0,
          total: 12,
          details: { skipped: 88 },
        }),
      ),
    ).toBe("Processed: 0 / 12 | Skipped: 88");
  });

  it("shows face count from pipeline-specific progress details", () => {
    expect(
      buildPipelineQueueStatsText(
        jobView({
          pipelineId: "face-detection",
          processed: 3,
          total: 8,
          details: { totalFacesDetected: 12 },
        }),
      ),
    ).toBe("Processed: 3 / 8 | Faces: 12");
  });

  it("shows rotation-specific counts without adding skipped to processed", () => {
    expect(
      buildPipelineQueueStatsText(
        jobView({
          pipelineId: "image-rotation-precheck",
          processed: 4,
          total: 6,
          details: { wronglyRotated: 2, skipped: 94, failed: 1 },
        }),
      ),
    ).toBe("Processed: 4 / 6 | Wrongly rotated: 2 | Skipped: 94 | Failed: 1");
  });
});

describe("buildPipelineQueueRightText", () => {
  it("shows the photo analysis model warmup hint until the first item is processed", () => {
    expect(
      buildPipelineQueueRightText(
        jobView({
          pipelineId: "photo-analysis",
          processed: 0,
          total: 12,
          details: { model: "llava:latest", skipped: 3 },
        }),
      ),
    ).toBe("Loading AI model llava:latest - it may take 1-2min");
  });

  it("hides the model warmup hint after processing starts", () => {
    expect(
      buildPipelineQueueRightText(
        jobView({
          pipelineId: "photo-analysis",
          processed: 1,
          total: 12,
          details: { model: "llava:latest" },
        }),
      ),
    ).toBeNull();
  });
});
