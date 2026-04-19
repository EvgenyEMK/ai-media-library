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

test.describe("Folder AI summary", () => {
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
        const unsubscribe = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-completed" && event.jobId === jobId) {
            unsubscribe();
            resolve();
          }
        });
      });
    }, fixture.root);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder AI analysis summary" })).toBeVisible();

    await electronApp.evaluate(async ({ ipcMain }) => {
      ipcMain.removeHandler("media:get-active-job-statuses");
      ipcMain.handle("media:get-active-job-statuses", async () => ({
        photoAnalysis: { jobId: "e2e-running-photo", folderPath: "C:\\e2e\\running" },
        faceDetection: null,
        semanticIndex: null,
        metadataScan: null,
        pathAnalysis: null,
      }));
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

    // Trigger from Folder AI summary play button.
    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder AI analysis summary" })).toBeVisible();
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
});
