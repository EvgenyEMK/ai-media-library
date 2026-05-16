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
      <LastDataScanCard
        scanFreshness={scanFreshness({ folderTreeQuickScan: null })}
        dateFormat="DD.MM.YYYY"
        loading
      />,
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
        dateFormat="DD.MM.YYYY"
      />,
    );

    expect(screen.getByText("Folders missing full scan")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.getByText("folders")).toBeVisible();
  });

  it("uses single-folder copy when the dashboard is not showing a folder tree", () => {
    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({
            ultraFoldersScanned: 1,
            treeFoldersWithDirectMediaOnDiskCount: 1,
            treeFoldersWithMetadataFolderScanCount: 1,
          }),
        })}
        dateFormat="DD.MM.YYYY"
        hasSubfolders={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Folder scan" })).toBeVisible();
    expect(screen.getByText("Selected folder analyzed (quick scan)")).toBeVisible();
    expect(screen.getByText("folder")).toBeVisible();
  });

  it("shows added/changed files line when quick scan reports new or modified files", () => {
    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({ newFileCount: 2, modifiedFileCount: 1 }),
        })}
        dateFormat="DD.MM.YYYY"
      />,
    );

    expect(screen.getByText("Files to add/update in database")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
  });

  it("shows moved files line when count is non-zero", () => {
    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({ movedFileCount: 2 }),
        })}
        dateFormat="DD.MM.YYYY"
      />,
    );

    expect(screen.getByText("Moved files")).toBeVisible();
  });

  it("shows a spinner in the run action while a scan is pending", () => {
    const { container } = render(
      <LastDataScanCard
        scanFreshness={scanFreshness()}
        dateFormat="DD.MM.YYYY"
        actionPending
        onRunFolderScan={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Run Folder tree scan" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("shows scan menu on Play only when folder-level coverage is partial (not 0% or 100%)", () => {
    const onRun = (): void => undefined;
    const { rerender } = render(
      <LastDataScanCard scanFreshness={scanFreshness()} dateFormat="DD.MM.YYYY" onRunFolderScan={onRun} />,
    );
    expect(screen.getByRole("button", { name: "Run Folder tree scan" })).not.toHaveAttribute("aria-haspopup", "menu");

    rerender(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 10,
            treeFoldersWithMetadataFolderScanCount: 4,
          }),
        })}
        dateFormat="DD.MM.YYYY"
        onRunFolderScan={onRun}
      />,
    );
    expect(screen.getByRole("button", { name: "Run Folder tree scan" })).toHaveAttribute("aria-haspopup", "menu");
  });

  it("styles the outdated full-scan label in warning color when scan is amber", () => {
    const oldScan = new Date();
    oldScan.setDate(oldScan.getDate() - 45);

    render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          oldestFolderScanCompletedAt: oldScan.toISOString(),
          folderTreeQuickScan: baseQuickScan({
            newFileCount: 0,
            modifiedFileCount: 0,
          }),
        })}
        dateFormat="DD.MM.YYYY"
        outdatedAfterDays={30}
      />,
    );

    const label = screen.getByText("Full scan older than 30 days");
    expect(label).toHaveClass("text-warning");
  });

  it("shows quick-scan folder coverage as 99% when pending file updates round to 100%", () => {
    const { container } = render(
      <LastDataScanCard
        scanFreshness={scanFreshness({
          folderTreeQuickScan: baseQuickScan({
            treeFoldersWithDirectMediaOnDiskCount: 2489,
            treeFoldersWithMetadataFolderScanCount: 2489,
            newFileCount: 2,
            modifiedFileCount: 1,
          }),
        })}
        dateFormat="DD.MM.YYYY"
      />,
    );

    expect(container.textContent).toContain("99%");
    expect(container.textContent).not.toContain("100%");
  });
});
