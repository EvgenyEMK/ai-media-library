import { beforeEach, describe, expect, it, vi } from "vitest";

let nextRow = {
  total_images: 0,
  total_videos: 0,
  scanned_count: 0,
  unscanned_count: 0,
  oldest_metadata_extracted_at: null as string | null,
  last_metadata_extracted_at: null as string | null,
  last_metadata_scan_completed_at: null as string | null,
  oldest_folder_scan_completed_at: null as string | null,
};
const getCalls: { sql: string; args: unknown[] }[] = [];
let nextAllRows: Array<{ folder_path: string; metadata_scanned_at: string | null }> = [];
const allCalls: { sql: string; args: unknown[] }[] = [];

const mockDb = {
  prepare: (sql: string) => ({
    get: (...args: unknown[]) => {
      getCalls.push({ sql, args });
      return nextRow;
    },
    all: (...args: unknown[]) => {
      allCalls.push({ sql, args });
      return nextAllRows;
    },
  }),
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "local-default",
}));

import {
  getFolderMetadataScanCompletedAtByPath,
  getFolderSummaryOverview,
} from "./folder-summary-overview";

describe("getFolderSummaryOverview", () => {
  beforeEach(() => {
    getCalls.length = 0;
    allCalls.length = 0;
    nextAllRows = [];
    nextRow = {
      total_images: 0,
      total_videos: 0,
      scanned_count: 0,
      unscanned_count: 0,
      oldest_metadata_extracted_at: null,
      last_metadata_extracted_at: null,
      last_metadata_scan_completed_at: null,
      oldest_folder_scan_completed_at: null,
    };
  });

  it("returns image/video counts and oldest metadata scan timestamp", () => {
    nextRow = {
      total_images: 12,
      total_videos: 3,
      scanned_count: 10,
      unscanned_count: 5,
      oldest_metadata_extracted_at: "2026-04-01T10:00:00.000Z",
      last_metadata_extracted_at: "2026-04-27T10:00:00.000Z",
      last_metadata_scan_completed_at: "2026-04-28T08:00:00.000Z",
      oldest_folder_scan_completed_at: "2026-04-20T08:00:00.000Z",
    };

    const overview = getFolderSummaryOverview({ folderPath: "C:\\photos", recursive: true });

    expect(overview.totalImages).toBe(12);
    expect(overview.totalVideos).toBe(3);
    expect(overview.scanFreshness).toEqual({
      lastMetadataScanCompletedAt: "2026-04-28T08:00:00.000Z",
      oldestFolderScanCompletedAt: "2026-04-20T08:00:00.000Z",
      oldestMetadataExtractedAt: "2026-04-01T10:00:00.000Z",
      lastMetadataExtractedAt: "2026-04-27T10:00:00.000Z",
      scannedCount: 10,
      unscannedCount: 5,
      totalMedia: 15,
      notFullyScannedDirectSubfolderCount: 0,
    });
    expect(getCalls[0]?.args).toEqual([
      "local-default",
      "C:\\photos",
      "local-default",
      "C:\\photos",
      "C:\\photos\\%",
      "local-default",
      "C:\\photos\\%",
    ]);
  });

  it("adds direct-folder depth bindings for non-recursive overview", () => {
    getFolderSummaryOverview({ folderPath: "C:\\photos", recursive: false, libraryId: "library-a" });

    expect(getCalls[0]?.args).toEqual([
      "library-a",
      "C:\\photos",
      "library-a",
      "C:\\photos",
      "library-a",
      "C:\\photos\\%",
      "C:\\photos\\",
      "\\",
    ]);
    expect(getCalls[0]?.sql).toContain("instr(substr(mi.source_path");
  });
});

describe("getFolderMetadataScanCompletedAtByPath", () => {
  beforeEach(() => {
    getCalls.length = 0;
    allCalls.length = 0;
    nextAllRows = [];
  });

  it("returns scan timestamps only for direct folders with status rows", () => {
    nextAllRows = [
      {
        folder_path: "C:\\photos\\scanned",
        metadata_scanned_at: "2026-04-28T08:00:00.000Z",
      },
      {
        folder_path: "C:\\photos\\null-scan",
        metadata_scanned_at: null,
      },
    ];

    const scans = getFolderMetadataScanCompletedAtByPath([
      "C:\\photos\\scanned",
      "C:\\photos\\missing-row",
      "C:\\photos\\null-scan",
    ]);

    expect(scans).toEqual({
      "C:\\photos\\scanned": "2026-04-28T08:00:00.000Z",
      "C:\\photos\\null-scan": null,
    });
    expect(allCalls[0]?.args).toEqual([
      "local-default",
      "C:\\photos\\scanned",
      "C:\\photos\\missing-row",
      "C:\\photos\\null-scan",
    ]);
    expect(allCalls[0]?.sql).toContain("folder_path IN (?, ?, ?)");
  });

  it("skips the database when no folder paths are provided", () => {
    expect(getFolderMetadataScanCompletedAtByPath([])).toEqual({});
    expect(allCalls).toHaveLength(0);
  });
});
