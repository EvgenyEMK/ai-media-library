import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS, type FolderAiSummaryOverviewReport, type FolderTreeScanSummary } from "../../src/shared/ipc";

type IpcHandler = (_event: unknown, ...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  children: [] as Array<{ path: string; name: string }>,
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      mocks.handlers.set(channel, handler);
    }),
  },
  app: {
    getPath: () => "/tmp/emk-folder-ai-summary-test",
  },
}));

const mockQuickScan = {
  ultraFastScanMs: 0,
  normalScanMs: 0,
  normalTotalMs: 0,
  ultraChangedFolderCount: 0,
  ultraFoldersScanned: 10,
  ultraBaselineSeeded: true,
  treeFoldersWithDirectMediaOnDiskCount: 10,
  treeFoldersWithMetadataFolderScanCount: 8,
  oldestMetadataFolderScanAtAmongWalkedFolders: "2026-04-20T08:00:00.000Z",
  newFileCount: 0,
  modifiedFileCount: 0,
  deletedFileCount: 0,
  movedFileCount: 0,
  newOrModifiedFolderCount: 0,
  movedMatchModeUsed: "name-size" as const,
  deletedSamplePaths: [],
  movedItems: [],
  newSamplePaths: [],
  modifiedSamplePaths: [],
};

vi.mock("../storage", () => ({
  readSettings: vi.fn(async () => ({
    folderScanning: { quickScanMovedFileMatchMode: "name-size" },
  })),
}));

vi.mock("../lib/folder-tree-quick-scan-engine", () => ({
  runFolderTreeQuickScans: vi.fn(async () => ({ ...mockQuickScan })),
}));

vi.mock("../fs-media", () => ({
  readDirectFolderChildren: vi.fn(async () => mocks.children),
  readFolderChildren: vi.fn(async () => mocks.children),
}));

vi.mock("../db/folder-summary-overview", () => ({
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
      folderTreeQuickScan: null,
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
  });

  it("returns overview report with scan freshness from getFolderSummaryOverview", async () => {
    mocks.children = [
      { path: "C:\\photos\\a", name: "a" },
      { path: "C:\\photos\\b", name: "b" },
    ];

    registerFolderAiSummaryHandlers();
    const handler = mocks.handlers.get(IPC_CHANNELS.getFolderAiSummaryOverview);
    expect(handler).toBeDefined();

    const report = (await handler?.(null, "C:\\photos")) as FolderAiSummaryOverviewReport;

    expect(report.selectedWithSubfolders.scanFreshness.oldestFolderScanCompletedAt).toBe("2026-04-20T08:00:00.000Z");
    expect(report.selectedWithSubfolders.scanFreshness.lastMetadataExtractedAt).toBe("2026-04-27T10:00:00.000Z");
    expect(report.hasDirectSubfolders).toBe(true);
  });

  it("skips subfolder list when subfolder loading is disabled", async () => {
    mocks.children = [{ path: "C:\\photos\\missing-row", name: "missing-row" }];

    registerFolderAiSummaryHandlers();
    const handler = mocks.handlers.get(IPC_CHANNELS.getFolderAiSummaryOverview);
    const report = (await handler?.(null, "C:\\photos", { includeSubfolders: false })) as FolderAiSummaryOverviewReport;

    expect(report.subfolders).toEqual([]);
  });

  it("returns folder tree scan summary with quick scan payload", async () => {
    mocks.children = [
      { path: "C:\\photos\\scanned", name: "scanned" },
      { path: "C:\\photos\\missing-row", name: "missing-row" },
    ];

    registerFolderAiSummaryHandlers();
    const handler = mocks.handlers.get(IPC_CHANNELS.getFolderTreeScanSummary);
    const summary = (await handler?.(null, "C:\\photos")) as FolderTreeScanSummary;

    expect(summary).toEqual({
      hasDirectSubfolders: true,
      quickScan: { ...mockQuickScan },
    });
  });
});
