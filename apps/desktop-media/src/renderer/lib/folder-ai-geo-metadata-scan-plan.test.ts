import { describe, expect, it } from "vitest";
import type { FolderScanFreshness, FolderTreeQuickScanResult } from "../../shared/ipc";
import { computeGeoMetadataScanPlan } from "./folder-ai-geo-metadata-scan-plan";

function stubQuickScan(
  overrides: Partial<FolderTreeQuickScanResult>,
): FolderTreeQuickScanResult {
  return {
    ultraFastScanMs: 0,
    normalScanMs: 0,
    normalTotalMs: 0,
    ultraChangedFolderCount: 0,
    ultraFoldersScanned: 1,
    ultraBaselineSeeded: false,
    treeFoldersWithDirectMediaOnDiskCount: 0,
    treeFoldersWithMetadataFolderScanCount: 0,
    oldestMetadataFolderScanAtAmongWalkedFolders: null,
    newFileCount: 0,
    modifiedFileCount: 0,
    deletedFileCount: 0,
    movedFileCount: 0,
    newOrModifiedFolderCount: 0,
    movedMatchModeUsed: "name-size",
    deletedSamplePaths: [],
    movedItems: [],
    newSamplePaths: [],
    modifiedSamplePaths: [],
    ...overrides,
  };
}

function baseFreshness(overrides: Partial<FolderScanFreshness> = {}): FolderScanFreshness {
  return {
    lastMetadataScanCompletedAt: null,
    oldestFolderScanCompletedAt: new Date().toISOString(),
    oldestMetadataExtractedAt: null,
    lastMetadataExtractedAt: null,
    scannedCount: 0,
    unscannedCount: 0,
    totalMedia: 0,
    folderTreeQuickScan: null,
    ...overrides,
  };
}

describe("computeGeoMetadataScanPlan", () => {
  it("returns full when loading", () => {
    expect(
      computeGeoMetadataScanPlan({
        scanFreshness: baseFreshness({
          folderTreeQuickScan: stubQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 2,
            treeFoldersWithMetadataFolderScanCount: 2,
            ultraFoldersScanned: 2,
          }),
        }),
        hasSubfolders: true,
        loading: true,
        outdatedAfterDays: 7,
      }),
    ).toBe("full");
  });

  it("returns skip when tree is fully synced and not outdated (green)", () => {
    const recent = new Date().toISOString();
    expect(
      computeGeoMetadataScanPlan({
        scanFreshness: baseFreshness({
          oldestFolderScanCompletedAt: recent,
          folderTreeQuickScan: stubQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 3,
            treeFoldersWithMetadataFolderScanCount: 3,
            ultraFoldersScanned: 3,
            oldestMetadataFolderScanAtAmongWalkedFolders: recent,
          }),
        }),
        hasSubfolders: true,
        loading: false,
        outdatedAfterDays: 7,
      }),
    ).toBe("skip");
  });

  it("returns incremental when partial folder coverage (menu case)", () => {
    expect(
      computeGeoMetadataScanPlan({
        scanFreshness: baseFreshness({
          folderTreeQuickScan: stubQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 4,
            treeFoldersWithMetadataFolderScanCount: 2,
            ultraFoldersScanned: 4,
          }),
        }),
        hasSubfolders: true,
        loading: false,
        outdatedAfterDays: 7,
      }),
    ).toBe("incremental");
  });

  it("returns full when red but folder tree Play would run full scan (no incremental menu)", () => {
    expect(
      computeGeoMetadataScanPlan({
        scanFreshness: baseFreshness({
          folderTreeQuickScan: stubQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 1,
            treeFoldersWithMetadataFolderScanCount: 0,
            newFileCount: 1,
            ultraFoldersScanned: 1,
          }),
        }),
        hasSubfolders: true,
        loading: false,
        outdatedAfterDays: 7,
      }),
    ).toBe("full");
  });

  it("returns incremental when red with partial folder coverage (same as folder scan menu)", () => {
    expect(
      computeGeoMetadataScanPlan({
        scanFreshness: baseFreshness({
          folderTreeQuickScan: stubQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 2,
            treeFoldersWithMetadataFolderScanCount: 2,
            newFileCount: 1,
            ultraFoldersScanned: 2,
          }),
        }),
        hasSubfolders: true,
        loading: false,
        outdatedAfterDays: 7,
      }),
    ).toBe("incremental");
  });
});
