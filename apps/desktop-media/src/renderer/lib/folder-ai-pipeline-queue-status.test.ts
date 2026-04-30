import { describe, expect, it } from "vitest";
import type { BundleView, JobView, PipelineId } from "../../shared/pipeline-types";
import { getFolderAiPipelineQueueStatus } from "./folder-ai-pipeline-queue-status";

function jobView(options: {
  pipelineId: PipelineId;
  folderPath: string;
  recursive?: boolean;
  state: JobView["state"];
}): JobView {
  return {
    jobId: `${options.pipelineId}-${options.state}`,
    pipelineId: options.pipelineId,
    params: { folderPath: options.folderPath, recursive: options.recursive === true },
    state: options.state,
    progress: {
      phase: null,
      processed: 0,
      total: null,
      message: null,
      details: null,
      lastUpdatedAt: 0,
    },
    error: null,
    startedAt: options.state === "running" ? 1 : null,
    finishedAt: null,
  };
}

function bundleView(job: JobView, state: BundleView["state"]): BundleView {
  return {
    bundleId: `${job.jobId}-bundle`,
    displayName: "bundle",
    state,
    jobs: [job],
    enqueuedAt: 1,
    startedAt: state === "running" ? 1 : null,
    finishedAt: null,
  };
}

describe("getFolderAiPipelineQueueStatus", () => {
  it("returns running for the same active folder pipeline", () => {
    const running = [
      bundleView(
        jobView({ pipelineId: "photo-analysis", folderPath: "C:/Photos/Trip", recursive: true, state: "running" }),
        "running",
      ),
    ];

    expect(
      getFolderAiPipelineQueueStatus({
        running,
        queued: [],
        pipeline: "photo",
        folderPath: "C:/Photos/Trip",
      }),
    ).toBe("running");
  });

  it("returns queued for a selected subfolder covered by a queued recursive parent job", () => {
    const queued = [
      bundleView(
        jobView({ pipelineId: "semantic-index", folderPath: "C:/Photos", recursive: true, state: "pending" }),
        "queued",
      ),
    ];

    expect(
      getFolderAiPipelineQueueStatus({
        running: [],
        queued,
        pipeline: "semantic",
        folderPath: "C:/Photos/Trip",
      }),
    ).toBe("queued");
  });
});
