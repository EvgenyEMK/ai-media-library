import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS, type FolderAiSummaryOverviewReport } from "../../src/shared/ipc";

type IpcHandler = (_event: unknown, ...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  children: [] as Array<{ path: string; name: string }>,
  scanCompletedAtByPath: {} as Record<string, string | null>,
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      mocks.handlers.set(channel, handler);
    }),
  },
}));

vi.mock("../fs-media", () => ({
  readDirectFolderChildren: vi.fn(async () => mocks.children),
  readFolderChildren: vi.fn(async () => mocks.children),
}));

vi.mock("../db/folder-summary-overview", () => ({
  getFolderMetadataScanCompletedAtByPath: vi.fn((folderPaths: string[]) =>
    Object.fromEntries(
      folderPaths
        .filter((folderPath) => Object.prototype.hasOwnProperty.call(mocks.scanCompletedAtByPath, folderPath))
        .map((folderPath) => [folderPath, mocks.scanCompletedAtByPath[folderPath]]),
    ),
  ),
  getFolderSummaryOverview: vi.fn(({ folderPath, recursive }: { folderPath: string; recursive: boolean }) => ({
    folderPath,
    recursive,
    totalImages: 0,
    totalVideos: 0,
    scanFreshness: {
      lastMetadataScanCompletedAt: folderPath === "C:\\photos" ? "2026-04-28T08:00:00.000Z" : null,
      oldestFolderScanCompletedAt: "2026-04-20T08:00:00.000Z",
      oldestMetadataExtractedAt: "2026-04-01T10:00:00.000Z",
      lastMetadataExtractedAt: "2026-04-27T10:00:00.000Z",
      scannedCount: 2,
      unscannedCount: 0,
      totalMedia: 2,
      notFullyScannedDirectSubfolderCount: 0,
    },
  })),
}));

vi.mock("../db/folder-ai-coverage", () => ({
  getFolderAiCoverage: vi.fn(),
  getFolderAiRollupsForPaths: vi.fn(() => ({})),
}));

vi.mock("../db/client", () => ({
  getDesktopDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
    })),
  })),
}));

vi.mock("../semantic-embeddings", () => ({
  MULTIMODAL_EMBED_MODEL: "test-model",
}));

import { registerFolderAiSummaryHandlers } from "./folder-ai-summary-handlers";

describe("registerFolderAiSummaryHandlers", () => {
  beforeEach(() => {
    mocks.handlers.clear();
    mocks.children = [];
    mocks.scanCompletedAtByPath = {};
  });

  it("counts only direct children with missing folder scan timestamps", async () => {
    mocks.children = [
      { path: "C:\\photos\\scanned", name: "scanned" },
      { path: "C:\\photos\\missing-row", name: "missing-row" },
      { path: "C:\\photos\\null-scan", name: "null-scan" },
    ];
    mocks.scanCompletedAtByPath = {
      "C:\\photos\\scanned": "2026-04-28T08:00:00.000Z",
      "C:\\photos\\null-scan": null,
    };

    registerFolderAiSummaryHandlers();
    const handler = mocks.handlers.get(IPC_CHANNELS.getFolderAiSummaryOverview);
    expect(handler).toBeDefined();

    const report = await handler?.(null, "C:\\photos") as FolderAiSummaryOverviewReport;

    expect(report.selectedWithSubfolders.scanFreshness.notFullyScannedDirectSubfolderCount).toBe(2);
    expect(report.selectedWithSubfolders.scanFreshness.oldestFolderScanCompletedAt).toBe(
      "2026-04-20T08:00:00.000Z",
    );
    expect(report.selectedWithSubfolders.scanFreshness.lastMetadataExtractedAt).toBe(
      "2026-04-27T10:00:00.000Z",
    );
  });

  it("skips direct child counting when subfolder loading is disabled", async () => {
    mocks.children = [{ path: "C:\\photos\\missing-row", name: "missing-row" }];

    registerFolderAiSummaryHandlers();
    const handler = mocks.handlers.get(IPC_CHANNELS.getFolderAiSummaryOverview);
    const report = await handler?.(null, "C:\\photos", { includeSubfolders: false }) as FolderAiSummaryOverviewReport;

    expect(report.selectedWithSubfolders.scanFreshness.notFullyScannedDirectSubfolderCount).toBe(0);
    expect(report.subfolders).toEqual([]);
  });

  it("returns lightweight folder tree scan summary", async () => {
    mocks.children = [
      { path: "C:\\photos\\scanned", name: "scanned" },
      { path: "C:\\photos\\missing-row", name: "missing-row" },
    ];
    mocks.scanCompletedAtByPath = {
      "C:\\photos\\scanned": "2026-04-28T08:00:00.000Z",
    };

    registerFolderAiSummaryHandlers();
    const handler = mocks.handlers.get(IPC_CHANNELS.getFolderTreeScanSummary);
    const summary = await handler?.(null, "C:\\photos");

    expect(summary).toEqual({
      hasDirectSubfolders: true,
      notFullyScannedDirectSubfolderCount: 1,
    });
  });
});
