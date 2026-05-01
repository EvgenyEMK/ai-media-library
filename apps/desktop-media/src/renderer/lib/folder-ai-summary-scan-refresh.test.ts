import { describe, expect, it } from "vitest";
import {
  shouldRefreshFolderAiSummaryAfterPipeline,
  shouldRefreshFolderAiSummaryAfterScan,
} from "./folder-ai-summary-scan-refresh";

describe("shouldRefreshFolderAiSummaryAfterScan", () => {
  it("ignores metadata scans that did not change catalog or geo data", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos", {
        changed: false,
        folderPath: "C:\\photos",
        foldersTouched: ["C:\\photos"],
      }),
    ).toBe(false);
  });

  it("refreshes when a changed scan touches the visible folder subtree", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos", {
        changed: true,
        folderPath: "C:\\photos\\trip",
        foldersTouched: ["C:\\photos\\trip"],
      }),
    ).toBe(true);
  });

  it("refreshes when a changed recursive scan root contains the visible folder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos\\trip", {
        changed: true,
        folderPath: "C:\\photos",
        foldersTouched: ["C:\\photos"],
      }),
    ).toBe(true);
  });

  it("ignores changed scans outside the visible folder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos", {
        changed: true,
        folderPath: "D:\\archive",
        foldersTouched: ["D:\\archive"],
      }),
    ).toBe(false);
  });
});

describe("shouldRefreshFolderAiSummaryAfterPipeline", () => {
  it("refreshes when a pipeline completes for the visible folder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterPipeline("C:\\photos", {
        jobId: "job-1",
        folderPath: "C:\\photos",
        kind: "rotation",
        completedAt: "2026-05-01T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("refreshes when a pipeline completes for a visible subfolder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterPipeline("C:\\photos", {
        jobId: "job-1",
        folderPath: "C:\\photos\\trip",
        kind: "face",
        completedAt: "2026-05-01T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("refreshes when a recursive pipeline root contains the visible folder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterPipeline("C:\\photos\\trip", {
        jobId: "job-1",
        folderPath: "C:\\photos",
        kind: "semantic",
        completedAt: "2026-05-01T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("ignores pipeline completions outside the visible folder tree", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterPipeline("C:\\photos", {
        jobId: "job-1",
        folderPath: "D:\\archive",
        kind: "photo",
        completedAt: "2026-05-01T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});
