import { describe, expect, it } from "vitest";
import type { DuplicateFilesSession } from "../types/duplicate-files-session";
import {
  duplicateScanSessionMatchesJobFinished,
  findFolderDuplicateScanJobId,
} from "./folder-duplicate-scan-queue-helpers";
import type { PipelineQueueSnapshot } from "../../shared/pipeline-types";

function snapshotWith(
  bundleId: string,
  jobId: string,
  pipelineId: "folder-duplicate-scan" | "metadata-scan" = "folder-duplicate-scan",
): PipelineQueueSnapshot {
  return {
    running: [],
    queued: [
      {
        bundleId,
        displayName: "Check duplicate files",
        state: "queued",
        jobs: [
          {
            jobId,
            pipelineId,
            params: {},
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
        enqueuedAt: 0,
        startedAt: null,
        finishedAt: null,
      },
    ],
    recent: [],
  };
}

describe("findFolderDuplicateScanJobId", () => {
  it("returns job id from queued bundle", () => {
    const snap = snapshotWith("b-1", "j-1");
    expect(findFolderDuplicateScanJobId(snap, "b-1")).toBe("j-1");
  });

  it("returns null when bundle is missing", () => {
    const snap = snapshotWith("b-1", "j-1");
    expect(findFolderDuplicateScanJobId(snap, "other")).toBeNull();
  });

  it("finds job in running before queued", () => {
    const snap: PipelineQueueSnapshot = {
      running: [
        {
          bundleId: "run",
          displayName: "x",
          state: "running",
          jobs: [
            {
              jobId: "jr",
              pipelineId: "folder-duplicate-scan",
              params: {},
              state: "running",
              progress: {
                phase: null,
                processed: 0,
                total: null,
                message: null,
                details: null,
                lastUpdatedAt: 0,
              },
              error: null,
              startedAt: 1,
              finishedAt: null,
            },
          ],
          enqueuedAt: 0,
          startedAt: 1,
          finishedAt: null,
        },
      ],
      queued: [],
      recent: [],
    };
    expect(findFolderDuplicateScanJobId(snap, "run")).toBe("jr");
  });
});

describe("duplicateScanSessionMatchesJobFinished", () => {
  const scanning = (
    overrides: Partial<Extract<DuplicateFilesSession, { kind: "scanning" }>>,
  ): Extract<DuplicateFilesSession, { kind: "scanning" }> => ({
    kind: "scanning",
    bundleId: "b",
    jobId: "j",
    folderPath: "/x",
    recursive: true,
    ...overrides,
  });

  it("matches by jobId when set", () => {
    expect(
      duplicateScanSessionMatchesJobFinished(scanning({ jobId: "j1" }), { jobId: "j1", bundleId: "other" }),
    ).toBe(true);
    expect(
      duplicateScanSessionMatchesJobFinished(scanning({ jobId: "j1" }), { jobId: "j2", bundleId: "b" }),
    ).toBe(false);
  });

  it("matches by bundleId when jobId is null", () => {
    expect(
      duplicateScanSessionMatchesJobFinished(scanning({ jobId: null, bundleId: "b99" }), {
        jobId: "any",
        bundleId: "b99",
      }),
    ).toBe(true);
    expect(
      duplicateScanSessionMatchesJobFinished(scanning({ jobId: null, bundleId: "b99" }), {
        jobId: "any",
        bundleId: "other",
      }),
    ).toBe(false);
  });
});
