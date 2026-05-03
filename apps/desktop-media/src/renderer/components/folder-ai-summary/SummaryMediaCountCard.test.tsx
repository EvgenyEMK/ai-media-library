// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FolderScanFreshness, FolderTreeQuickScanResult } from "../../../shared/ipc";
import { LastDataScanCard } from "./SummaryMediaCountCard";

function baseQuickScan(overrides: Partial<FolderTreeQuickScanResult> = {}): FolderTreeQuickScanResult {
  return {
    ultraFastScanMs: 0,
    normalScanMs: 0,
    normalTotalMs: 0,
    ultraChangedFolderCount: 0,
    ultraFoldersScanned: 10,
    ultraBaselineSeeded: true,
    treeFoldersWithDirectMediaOnDiskCount: 10,
    treeFoldersWithMetadataFolderScanCount: 10,
    oldestMetadataFolderScanAtAmongWalkedFolders: "2026-04-28T08:00:00.000Z",
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

function scanFreshness(overrides: Partial<FolderScanFreshness> = {}): FolderScanFreshness {
  return {
    lastMetadataScanCompletedAt: "2026-04-28T08:00:00.000Z",
    oldestFolderScanCompletedAt: "2026-04-28T08:00:00.000Z",
    oldestMetadataExtractedAt: "2026-04-01T10:00:00.000Z",
    lastMetadataExtractedAt: "2026-04-27T10:00:00.000Z",
    scannedCount: 2,
    unscannedCount: 0,
    totalMedia: 2,
    folderTreeQuickScan: baseQuickScan(),
    ...overrides,
  };
}

describe("LastDataScanCard", () => {
  afterEach(cleanup);

  it("uses neutral border while loading", () => {
    const { container } = render(
      <LastDataScanCard scanFreshness={scanFreshness({ folderTreeQuickScan: null })} loading />,
    );

    expect(screen.getByRole("heading", { name: "Folder tree scan" })).toBeVisible();
    expect(container.querySelector("section")).toHaveClass("border-border");
  });

  it("shows folders missing full scan when direct-media folders lack metadata scan rows", () => {
    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({
            ultraFoldersScanned: 50,
            treeFoldersWithDirectMediaOnDiskCount: 10,
            treeFoldersWithMetadataFolderScanCount: 7,
          }),
        })}
      />,
    );

    expect(screen.getByText("Folders missing full scan")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.getByText("folders")).toBeVisible();
  });

  it("shows added/changed files line when quick scan reports new or modified files", () => {
    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({ newFileCount: 2, modifiedFileCount: 1 }),
        })}
      />,
    );

    expect(screen.getByText("Added / changed files")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
  });

  it("shows moved files line when count is non-zero", () => {
    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({ movedFileCount: 2 }),
        })}
      />,
    );

    expect(screen.getByText("Moved files")).toBeVisible();
  });
});
