// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FolderScanFreshness } from "../../../shared/ipc";
import { LastDataScanCard } from "./SummaryMediaCountCard";

function scanFreshness(overrides: Partial<FolderScanFreshness> = {}): FolderScanFreshness {
  return {
    lastMetadataScanCompletedAt: "2026-04-28T08:00:00.000Z",
    oldestFolderScanCompletedAt: "2026-04-20T08:00:00.000Z",
    oldestMetadataExtractedAt: "2026-04-01T10:00:00.000Z",
    lastMetadataExtractedAt: "2026-04-27T10:00:00.000Z",
    scannedCount: 2,
    unscannedCount: 0,
    totalMedia: 2,
    directSubfolderCount: 2,
    notFullyScannedDirectSubfolderCount: 0,
    outdatedScannedFolderCount: 0,
    scannedFolderCount: 1,
    ...overrides,
  };
}

describe("LastDataScanCard", () => {
  afterEach(cleanup);

  it("shows missing direct subfolders and uses destructive treatment", () => {
    const { container } = render(
      <LastDataScanCard
        scanFreshness={scanFreshness({ notFullyScannedDirectSubfolderCount: 2 })}
        hasSubfolders
      />,
    );

    expect(screen.getByRole("heading", { name: "Folder tree scan" })).toBeVisible();
    expect(screen.getByText("Not scanned direct subfolders")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(container.querySelector("section")).toHaveClass("border-destructive/70");
  });

  it("hides missing direct subfolder row when fully scanned", () => {
    render(<LastDataScanCard scanFreshness={scanFreshness()} hasSubfolders />);

    expect(screen.queryByText("Not scanned direct subfolders")).toBeNull();
  });
});
