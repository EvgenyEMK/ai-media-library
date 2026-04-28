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

test.describe("AI image analysis LLM downscale settings", () => {
  test("defaults: downscale on and longest side 1024 in saved settings", async ({ mainWindow }) => {
    const photoAnalysis = await mainWindow.evaluate(async () => {
      const s = await window.desktopApi.getSettings();
      return s.photoAnalysis;
    });
    expect(photoAnalysis.downscaleBeforeLlm).toBe(true);
    expect(photoAnalysis.downscaleLongestSidePx).toBe(1024);
  });

  test("analyzeFolderPhotos request reflects downscale on (default) and off after unchecking", async ({
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
        ((globalThis as any).__e2ePhotoAnalyzeRequests as unknown[]).push(request);
        const bw = BrowserWindow.fromWebContents(event.sender);
        bw?.webContents.send("media:photo-analysis-progress", {
          type: "job-started",
          jobId,
          folderPath: request.folderPath,
          total: 0,
          items: [],
        });
        bw?.webContents.send("media:photo-analysis-progress", {
          type: "job-completed",
          jobId,
          folderPath: request.folderPath,
          completed: 0,
          failed: 0,
          cancelled: 0,
          averageSecondsPerFile: 0,
        });
        return { jobId, total: 0 };
      });
    });

    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByText("Add library folder").click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();
    const subAFolderButton = sidebar.getByRole("button", { name: "sub-a", exact: true });

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
    await mainWindow.getByRole("button", { name: "Close scan results" }).click();
    await subAFolderButton.click();

    await mainWindow.getByRole("button", { name: "More actions" }).click();
    const menu = mainWindow.locator(".desktop-actions-menu");
    const row = menu.locator(".photo-ai-row");
    await row.locator("button.face-detect-play-btn").click();

    await expect
      .poll(async () =>
        electronApp.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return ((globalThis as any).__e2ePhotoAnalyzeRequests ?? []) as unknown[];
        }),
      )
      .toHaveLength(1);

    let requests = await electronApp.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((globalThis as any).__e2ePhotoAnalyzeRequests ?? []) as Array<{
        downscaleBeforeLlm?: boolean;
        downscaleLongestSidePx?: number;
      }>;
    });
    expect(requests[0]!.downscaleBeforeLlm).toBe(true);
    expect(requests[0]!.downscaleLongestSidePx).toBe(1024);

    await mainWindow.getByText("Settings").click();
    const hideAdvancedSettingsCheckbox = mainWindow.getByRole("checkbox", {
      name: /Hide advanced settings/i,
    });
    if (await hideAdvancedSettingsCheckbox.isChecked()) {
      await hideAdvancedSettingsCheckbox.uncheck();
    }
    const photoAnalysisSection = mainWindow
      .locator("details")
      .filter({ has: mainWindow.getByText("AI image analysis", { exact: true }) });
    await photoAnalysisSection.locator("summary").first().click();
    const downscaleCheckbox = mainWindow.getByRole("checkbox", {
      name: /Downscale image dimensions before passing to LLM/i,
    });
    await expect(downscaleCheckbox).toBeVisible();
    await downscaleCheckbox.uncheck();
    await expect(downscaleCheckbox).not.toBeChecked();

    await mainWindow.getByRole("button", { name: "Folders" }).click();
    await subAFolderButton.click();
    await mainWindow.getByRole("button", { name: "More actions" }).click();
    const menu2 = mainWindow.locator(".desktop-actions-menu");
    const row2 = menu2.locator(".photo-ai-row");
    await row2.locator("button.face-detect-play-btn").click();

    await expect
      .poll(async () =>
        electronApp.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return ((globalThis as any).__e2ePhotoAnalyzeRequests ?? []) as unknown[];
        }),
      )
      .toHaveLength(2);

    requests = await electronApp.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((globalThis as any).__e2ePhotoAnalyzeRequests ?? []) as Array<{
        downscaleBeforeLlm?: boolean;
      }>;
    });
    expect(requests[1]!.downscaleBeforeLlm).toBe(false);
  });
});
