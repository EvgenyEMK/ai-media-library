import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import {
  createMoveChurnFixture,
  removeMoveChurnFixture,
  type MoveChurnFixture,
} from "./fixtures/test-images";

let fixture: MoveChurnFixture;

test.beforeAll(() => {
  fixture = createMoveChurnFixture();
});

test.afterAll(() => {
  removeMoveChurnFixture(fixture);
});

async function closeScanResultsIfVisible(mainWindow: Parameters<typeof mainDesktopSidebar>[0]): Promise<void> {
  const closeButton = mainWindow.getByRole("button", { name: "Close scan results" });
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}

test.describe("Folder AI summary", () => {
  test("folder tree scan card counts only direct children missing scan timestamps", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      const { jobId } = await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => {
          unsubscribe();
          resolve();
        }, 60_000);
        const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-completed" && event.jobId === jobId) {
            window.clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      });
    }, fixture.subA);
    await closeScanResultsIfVisible(mainWindow);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();

    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    const folderTreeScanCard = mainWindow.locator("section").filter({
      has: mainWindow.getByRole("heading", { name: "Folder tree scan" }),
    }).first();
    await expect(folderTreeScanCard).toContainText("Not scanned: 1");
    await expect(folderTreeScanCard).toHaveClass(/border-destructive/);
    await expect(folderTreeScanCard).toContainText(/Oldest scan: (?!—)/);
    await expect(folderTreeScanCard).toContainText(/Last data change: (?!—)/);
  });

  test("shows blocking dialog when trying to start another pipeline", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      const { jobId } = await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => {
          unsubscribe();
          resolve();
        }, 60_000);
        const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-completed" && event.jobId === jobId) {
            window.clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      });
    }, fixture.root);
    await closeScanResultsIfVisible(mainWindow);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    await expect(mainWindow.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    await expect(mainWindow.getByRole("heading", { name: "Wrongly rotated images" })).toBeVisible();
    await mainWindow.getByRole("tab", { name: "Geo-location" }).click();
    await expect(mainWindow.getByRole("columnheader", { name: "Files with GPS" })).toBeVisible();
    await mainWindow.getByRole("tab", { name: "Subfolders" }).click();

    await electronApp.evaluate(async ({ ipcMain }) => {
      let firstCall = true;
      ipcMain.removeHandler("pipelines:get-snapshot");
      ipcMain.handle("pipelines:get-snapshot", async () => {
        const running = firstCall
          ? [
              {
                bundleId: "e2e-running-bundle",
                displayName: "E2E Running",
                state: "running",
                jobs: [
                  {
                    jobId: "e2e-running-photo",
                    pipelineId: "photo-analysis",
                    state: "running",
                    progress: {
                      phase: "analyzing",
                      processed: 0,
                      total: null,
                      message: null,
                      details: null,
                      lastUpdatedAt: Date.now(),
                    },
                    error: null,
                    startedAt: Date.now(),
                    finishedAt: null,
                  },
                ],
                enqueuedAt: Date.now(),
                startedAt: Date.now(),
                finishedAt: null,
              },
            ]
          : [];
        firstCall = false;
        return { running, queued: [], recent: [] };
      });
    });

    await mainWindow
      .getByRole("button", { name: "Run AI search index for this folder and sub-folders" })
      .first()
      .click();

    const dialog = mainWindow.getByRole("dialog", { name: "Pipeline already running" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Please cancel currently running process or wait until it finishes"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await expect(dialog).toBeHidden();
  });

  test("summary play and folder menu use same photo pipeline request", async ({
    electronApp,
    mainWindow,
  }) => {
    await electronApp.evaluate(async ({ ipcMain, BrowserWindow }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__e2ePhotoAnalyzeRequests = [];
      ipcMain.removeHandler("media:analyze-folder-photos");
      ipcMain.handle("media:analyze-folder-photos", async (event, request) => {
        const jobId = `e2e-photo-${Date.now()}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__e2ePhotoAnalyzeRequests.push(request);
        const bw = BrowserWindow.fromWebContents(event.sender);
        bw?.webContents.send("media:photo-analysis-progress", {
          type: "job-started",
          jobId,
          folderPath: request.folderPath,
          total: 1,
          items: [],
        });
        bw?.webContents.send("media:photo-analysis-progress", {
          type: "job-completed",
          jobId,
          folderPath: request.folderPath,
          completed: 1,
          failed: 0,
          cancelled: 0,
          averageSecondsPerFile: 0.1,
        });
        return { jobId, total: 1 };
      });
    });

    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      const started = await Promise.race([
        window.desktopApi.scanFolderMetadata({
          folderPath,
          recursive: true,
        }),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 60_000)),
      ]);
      if (!started) {
        return;
      }
      const { jobId } = started;
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => {
          unsubscribe();
          resolve();
        }, 60_000);
        const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-completed" && event.jobId === jobId) {
            window.clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      });
    }, fixture.root);
    await closeScanResultsIfVisible(mainWindow);

    // Trigger from Folder AI summary play button.
    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    await mainWindow.getByRole("tab", { name: "Subfolders" }).click();
    await mainWindow
      .getByRole("button", { name: "Run AI image analysis for this folder and sub-folders" })
      .first()
      .click();

    // Trigger from folder right-click menu (existing path).
    await mainWindow.getByRole("button", { name: "Back to images" }).click();
    await mainWindow.getByRole("button", { name: "More actions" }).click();
    const menu = mainWindow.locator(".desktop-actions-menu");
    const row = menu.locator(".photo-ai-row");
    await expect(row.getByText("Image AI analysis")).toBeVisible();
    await row.locator("button.face-detect-play-btn").click();

    const requests = await electronApp.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((globalThis as any).__e2ePhotoAnalyzeRequests ?? []) as Array<{
        folderPath: string;
        recursive?: boolean;
        mode?: string;
      }>;
    });

    expect(requests.length).toBeGreaterThanOrEqual(2);
    const fromSummary = requests[0]!;
    const fromMenu = requests[1]!;
    expect(fromSummary.folderPath).toBe(fixture.root);
    expect(fromMenu.folderPath).toBe(fixture.root);
    expect(fromSummary.recursive).toBe(true);
    expect(fromMenu.recursive).toBe(true);
    expect(fromSummary.mode).toBe("missing");
    expect(fromMenu.mode).toBe("missing");
  });

  test("wrongly rotated images play button shows Background operations progress", async ({
    electronApp,
    mainWindow,
  }) => {
    await electronApp.evaluate(async ({ ipcMain, BrowserWindow }) => {
      const globalWithRequests = globalThis as { __e2eRotationRequests?: Array<{ folderPath: string; recursive?: boolean }> };
      globalWithRequests.__e2eRotationRequests = [];
      ipcMain.removeHandler("media:detect-folder-image-rotation");
      ipcMain.handle("media:detect-folder-image-rotation", async (event, request: { folderPath: string; recursive?: boolean }) => {
        const jobId = `e2e-rotation-${Date.now()}`;
        globalWithRequests.__e2eRotationRequests?.push(request);
        const bw = BrowserWindow.fromWebContents(event.sender);
        bw?.webContents.send("media:image-rotation-progress", {
          type: "job-started",
          jobId,
          folderPath: request.folderPath,
          total: 2,
        });
        setTimeout(() => {
          bw?.webContents.send("media:image-rotation-progress", {
            type: "progress",
            jobId,
            folderPath: request.folderPath,
            processed: 1,
            total: 2,
            wronglyRotated: 0,
            skipped: 0,
            failed: 0,
          });
          bw?.webContents.send("media:image-rotation-progress", {
            type: "job-completed",
            jobId,
            folderPath: request.folderPath,
            processed: 2,
            total: 2,
            wronglyRotated: 1,
            skipped: 0,
            failed: 0,
          });
        }, 100);
        return { jobId, total: 2 };
      });
    });

    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      const { jobId } = await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
      await new Promise<void>((resolve) => {
        const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-completed" && event.jobId === jobId) {
            unsubscribe();
            resolve();
          }
        });
      });
    }, fixture.root);
    await closeScanResultsIfVisible(mainWindow);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    await mainWindow.getByRole("button", { name: "Run Wrongly rotated images" }).first().click();

    const backgroundOperations = mainWindow.getByRole("region", { name: /Background operations/i });
    await expect(backgroundOperations).toBeVisible();
    await expect(backgroundOperations.getByRole("heading", { name: /Wrongly rotated images/i })).toBeVisible();
    await expect(mainWindow.getByText(/Processed: \d+ \/ 2 \| Wrongly rotated: \d+/)).toBeVisible();

    const requests = await electronApp.evaluate(() => {
      const globalWithRequests = globalThis as { __e2eRotationRequests?: Array<{ folderPath: string; recursive?: boolean }> };
      return globalWithRequests.__e2eRotationRequests ?? [];
    });
    expect(requests[0]?.folderPath).toBe(fixture.root);
    expect(requests[0]?.recursive).toBe(true);
  });

  test("cancelling wrongly rotated images does not restart the progress card", async ({
    electronApp,
    mainWindow,
  }) => {
    await electronApp.evaluate(async ({ ipcMain, BrowserWindow }) => {
      type RotationCancelState = {
        jobId: string | null;
        folderPath: string | null;
        cancelled: boolean;
      };
      const state: RotationCancelState = { jobId: null, folderPath: null, cancelled: false };
      (globalThis as { __e2eRotationCancelState?: RotationCancelState }).__e2eRotationCancelState = state;
      ipcMain.removeHandler("media:detect-folder-image-rotation");
      ipcMain.removeHandler("media:cancel-image-rotation-detection");
      ipcMain.handle("media:detect-folder-image-rotation", async (event, request: { folderPath: string; recursive?: boolean }) => {
        const jobId = `e2e-rotation-cancel-${Date.now()}`;
        state.jobId = jobId;
        state.folderPath = request.folderPath;
        state.cancelled = false;
        const bw = BrowserWindow.fromWebContents(event.sender);
        bw?.webContents.send("media:image-rotation-progress", {
          type: "job-started",
          jobId,
          folderPath: request.folderPath,
          total: 10,
        });
        setTimeout(() => {
          if (state.cancelled) return;
          bw?.webContents.send("media:image-rotation-progress", {
            type: "progress",
            jobId,
            folderPath: request.folderPath,
            processed: 1,
            total: 10,
            wronglyRotated: 0,
            skipped: 0,
            failed: 0,
          });
        }, 500);
        return { jobId, total: 10 };
      });
      ipcMain.handle("media:cancel-image-rotation-detection", async (event, jobId: string) => {
        state.cancelled = true;
        const bw = BrowserWindow.fromWebContents(event.sender);
        bw?.webContents.send("media:image-rotation-progress", {
          type: "job-cancelled",
          jobId,
          folderPath: state.folderPath ?? "",
          processed: 0,
          total: 10,
          wronglyRotated: 0,
          skipped: 0,
          failed: 0,
        });
        return true;
      });
    });

    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      const { jobId } = await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
      await new Promise<void>((resolve) => {
        const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-completed" && event.jobId === jobId) {
            unsubscribe();
            resolve();
          }
        });
      });
    }, fixture.root);
    await closeScanResultsIfVisible(mainWindow);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    await mainWindow.getByRole("button", { name: "Run Wrongly rotated images" }).first().click();

    const backgroundOperations = mainWindow.getByRole("region", { name: /Background operations/i });
    await expect(backgroundOperations.getByRole("heading", { name: /Wrongly rotated images/i })).toBeVisible();
    await backgroundOperations.getByRole("button", { name: "Cancel image rotation detection" }).click();
    await expect(backgroundOperations.getByRole("heading", { name: /Wrongly rotated images/i })).toBeHidden();
    await mainWindow.waitForTimeout(800);
    await expect(backgroundOperations.getByRole("heading", { name: /Wrongly rotated images/i })).toBeHidden();

    const cancelled = await electronApp.evaluate(() => {
      return (globalThis as { __e2eRotationCancelState?: { cancelled: boolean } }).__e2eRotationCancelState?.cancelled ?? false;
    });
    expect(cancelled).toBe(true);
  });

  test("opens paginated rotation review from summary card", async ({
    electronApp,
    mainWindow,
  }) => {
    await electronApp.evaluate(async ({ ipcMain }) => {
      const geo = {
        images: { total: 2, withGpsCount: 0, withoutGpsCount: 2, locationDetailsDoneCount: 0 },
        videos: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
        locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
      };
      const pipeline = {
        doneCount: 2,
        failedCount: 0,
        totalImages: 2,
        label: "done",
      };
      ipcMain.removeHandler("media:get-folder-ai-coverage");
      ipcMain.handle("media:get-folder-ai-coverage", async (_event, folderPath: string, recursive: boolean) => ({
        folderPath,
        recursive,
        totalImages: 2,
        photo: pipeline,
        face: pipeline,
        semantic: pipeline,
        rotation: { ...pipeline, issueCount: 1 },
        geo,
      }));
      ipcMain.removeHandler("media:get-folder-ai-wrongly-rotated-images");
      ipcMain.handle("media:get-folder-ai-wrongly-rotated-images", async (_event, request: { folderPath: string }) => ({
        total: 1,
        page: 1,
        pageSize: 24,
        items: [
          {
            id: "e2e-rotated",
            sourcePath: `${request.folderPath}\\sub-a\\stays.jpg`,
            name: "stays.jpg",
            imageUrl: "file:///e2e/stays.jpg",
            folderPathRelative: "sub-a",
            rotationAngleClockwise: 90,
            cropRel: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          },
        ],
      }));
    });

    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();

    const rotationCard = mainWindow.locator("section").filter({
      has: mainWindow.getByRole("heading", { name: "Wrongly rotated images" }),
    }).first();
    await rotationCard.getByRole("button", { name: "View wrongly rotated images" }).click();

    await expect(mainWindow.getByText("Include subfolders")).toBeVisible();
    await expect(mainWindow.getByText("Showing 1-1 of 1").first()).toBeVisible();
    const reviewRow = mainWindow.getByRole("article").filter({ hasText: "stays.jpg" });
    await expect(reviewRow).toBeVisible();
    await expect(reviewRow.getByText("sub-a")).toBeVisible();
    await expect(mainWindow.getByText("Review only - apply/save coming soon.")).toBeVisible();
  });
});
