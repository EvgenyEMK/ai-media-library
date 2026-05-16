import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import {
  createMoveChurnFixture,
  removeMoveChurnFixture,
  type MoveChurnFixture,
} from "./fixtures/test-images";

/**
 * Folder AI analysis summary (sidebar folder → "Folder AI analysis summary"):
 * folder-tree scan card after metadata scan,
 * AI search index control when semantic-index is already running (play button disabled — no modal),
 * photo pipeline enqueue from the summary,
 * wrongly-rotated precheck progress/cancel in Background operations,
 * and opening paginated rotation review from the summary card.
 * Uses a temp fixture tree from `createMoveChurnFixture`.
 */

/** Matches {@link formatDateByPreference} outputs (Settings → viewer date format). */
const FORMATTED_VIEWER_DATE_RE =
  /\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{2}\/\d{2}\/\d{4}/;

let fixture: MoveChurnFixture;

test.beforeAll(() => {
  fixture = createMoveChurnFixture();
});

test.afterAll(() => {
  removeMoveChurnFixture(fixture);
});

async function expandBackgroundOperationsPanelIfNeeded(
  mainWindow: Parameters<typeof mainDesktopSidebar>[0],
): Promise<void> {
  const expand = mainWindow.getByRole("button", { name: "Expand background operations panel" });
  if (await expand.isVisible()) {
    await expand.click();
  }
}

test.describe("Folder AI summary", () => {
  test("folder tree scan card reflects full-tree scan coverage", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      const completion = new Promise<void>((resolve, reject) => {
        let jobId: string | null = null;
        const timer = window.setTimeout(() => {
          unsub();
          reject(new Error("Timed out waiting for metadata scan job-completed"));
        }, 120_000);
        const unsub = window.desktopApi.onMetadataScanProgress((event) => {
          if (event.type === "job-started" && event.folderPath === folderPath) {
            jobId = event.jobId;
            return;
          }
          if (event.type === "job-completed" && jobId !== null && event.jobId === jobId) {
            window.clearTimeout(timer);
            unsub();
            resolve();
          }
        });
      });
      const scanPromise = window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
      await completion;
      await scanPromise;
    }, fixture.subA);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();

    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    const folderTreeScanCard = mainWindow
      .getByRole("heading", { name: "Folder tree scan" })
      .locator("xpath=ancestor::section[contains(@class,'border')]");
    // Fixture has direct media only under `sub-a`; scanning `sub-a` covers the only direct-media folder in the root tree.
    await expect(folderTreeScanCard.getByText("Folders analyzed (quick scan)")).toBeVisible();
    await expect(folderTreeScanCard).not.toContainText("Folders missing full scan");
    await expect(folderTreeScanCard).toHaveClass(/border-success/);
    await expect(folderTreeScanCard.getByText("Last file change")).toBeVisible();
    await expect(folderTreeScanCard.locator(".inline-grid").getByText(FORMATTED_VIEWER_DATE_RE)).toBeVisible();
  });

  test("AI search index play is disabled while semantic-index is running for this folder", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
    }, fixture.root);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    await expect(mainWindow.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    await expect(mainWindow.getByRole("heading", { name: "Wrongly rotated images" })).toBeVisible();

    const now = Date.now();
    const snapshot = {
      running: [
        {
          bundleId: "e2e-semantic-running-bundle",
          displayName: "E2E semantic index",
          state: "running" as const,
          jobs: [
            {
              jobId: "e2e-semantic-running-job",
              pipelineId: "semantic-index",
              params: { folderPath: normalizedRoot, recursive: true },
              state: "running" as const,
              progress: {
                phase: "indexing",
                processed: 0,
                total: 10,
                message: null,
                details: null,
                lastUpdatedAt: now,
              },
              error: null,
              startedAt: now,
              finishedAt: null,
            },
          ],
          enqueuedAt: now,
          startedAt: now,
          finishedAt: null,
        },
      ],
      queued: [] as const,
      recent: [] as const,
    };

    await mainWindow.evaluate(async (payload: typeof snapshot) => {
      await window.desktopApi.pipelines.e2ePushQueueSnapshot(payload);
    }, snapshot);

    const semanticControl = mainWindow.getByRole("button", { name: "AI search index is running" });
    await expect(semanticControl).toBeVisible();
    await expect(semanticControl).toBeDisabled();
  });

  test("summary play enqueues photo-analysis pipeline with expected folder scope", async ({
    electronApp,
    mainWindow,
  }) => {
    await electronApp.evaluate(async ({ ipcMain }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__e2ePipelinePhotoEnqueueRequests = [];
      ipcMain.removeHandler("pipelines:enqueue-bundle");
      ipcMain.handle("pipelines:enqueue-bundle", async (_event, request: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__e2ePipelinePhotoEnqueueRequests.push(request);
        return { ok: true, bundleId: `e2e-photo-bundle-${Date.now()}` };
      });
    });

    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
    }, fixture.root);

    // Trigger from Folder AI summary play button.
    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();

    const closeMetaDock = mainWindow.getByRole("button", { name: "Close metadata scan status" });
    if (await closeMetaDock.isVisible()) {
      await closeMetaDock.click();
    }

    await expandBackgroundOperationsPanelIfNeeded(mainWindow);
    const runPhotoBtn = mainWindow.getByRole("button", { name: /^Run AI Image analysis$/ });
    await expect(runPhotoBtn).toBeEnabled({ timeout: 15_000 });
    await runPhotoBtn.click();

    await expect
      .poll(async () =>
        electronApp.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return ((globalThis as any).__e2ePipelinePhotoEnqueueRequests ?? []) as unknown[];
        }),
      )
      .toHaveLength(1);

    const requests = await electronApp.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((globalThis as any).__e2ePipelinePhotoEnqueueRequests ?? []) as Array<{
        kind: string;
        payload: {
          pipelineId?: string;
          params?: { folderPath: string; recursive?: boolean; mode?: string };
        };
      }>;
    });

    const req = requests[0]!;
    expect(req.kind).toBe("single-job");
    expect(req.payload.pipelineId).toBe("photo-analysis");
    const params = req.payload.params!;
    expect(params.folderPath).toBe(fixture.root);
    expect(params.recursive).toBe(true);
    expect(params.mode).toBe("missing");
  });

  test("wrongly rotated images play button shows Background operations progress", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
    }, fixture.root);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    const runRotationBtn1 = mainWindow.getByRole("button", { name: "Run Wrongly rotated images" }).first();
    await runRotationBtn1.scrollIntoViewIfNeeded();
    await runRotationBtn1.click({ force: true });

    const backgroundOperations = mainWindow.getByRole("region", { name: /Background operations/i });
    await expect(backgroundOperations).toBeVisible();
    await expandBackgroundOperationsPanelIfNeeded(mainWindow);
    const pipelineQueue = mainWindow.getByLabel("Pipeline queue");
    await expect(pipelineQueue).toBeVisible();
    await expect(pipelineQueue.getByRole("heading", { name: /Image rotation precheck/ })).toBeVisible({
      timeout: 120_000,
    });
    await expect(pipelineQueue.getByText(/Processed: \d+ \/ \d+ \| Wrongly rotated: \d+/)).toBeVisible({
      timeout: 120_000,
    });
  });

  test("cancelling wrongly rotated images does not restart the progress card", async ({
    electronApp,
    mainWindow,
  }) => {
    await mockFolderDialog(electronApp, fixture.root);
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

    const normalizedRoot = path.normalize(fixture.root);
    const sidebar = mainDesktopSidebar(mainWindow);
    const rootRowButton = sidebar.getByRole("button", { name: normalizedRoot, exact: true });
    await rootRowButton.click();

    await mainWindow.evaluate(async (folderPath) => {
      await window.desktopApi.scanFolderMetadata({
        folderPath,
        recursive: true,
      });
    }, fixture.root);

    await rootRowButton.click({ button: "right" });
    await mainWindow
      .locator("[data-sidebar-tree-menu]")
      .getByRole("button", { name: "Folder AI analysis summary", exact: true })
      .click();
    await expect(mainWindow.getByRole("heading", { name: "Folder tree analysis summary" })).toBeVisible();
    const runRotationBtn2 = mainWindow.getByRole("button", { name: "Run Wrongly rotated images" }).first();
    await runRotationBtn2.scrollIntoViewIfNeeded();
    await runRotationBtn2.click({ force: true });

    await expandBackgroundOperationsPanelIfNeeded(mainWindow);
    const pipelineQueue = mainWindow.getByLabel("Pipeline queue");
    await expect(pipelineQueue).toBeVisible();
    await expect(pipelineQueue.getByRole("heading", { name: /Image rotation precheck/ })).toBeVisible({
      timeout: 120_000,
    });
    await pipelineQueue.getByRole("button", { name: /Cancel Image rotation precheck/ }).click();
    await expect(pipelineQueue.getByRole("heading", { name: /Image rotation precheck/ })).toBeHidden({
      timeout: 30_000,
    });
    await mainWindow.waitForTimeout(800);
    await expect(pipelineQueue.getByRole("heading", { name: /Image rotation precheck/ })).toBeHidden();
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
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

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
    await expect(mainWindow.getByText("Showing 1-1 of 1")).toHaveCount(0);
    const reviewRow = mainWindow.getByRole("article").filter({ hasText: "stays.jpg" });
    await expect(reviewRow).toBeVisible();
    await expect(reviewRow.getByText("sub-a")).toBeVisible();
    await expect(mainWindow.getByText("Review only - apply/save coming soon.")).toHaveCount(0);
  });

  test("rotation review stays visible when Albums was opened before Insights folder analysis", async ({
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
            id: "e2e-rotated-albums",
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
    await mainWindow.getByRole("button", { name: "Add library folder" }).click();

    const sidebar = mainDesktopSidebar(mainWindow);
    await expect(
      sidebar.getByRole("button", { name: path.normalize(fixture.root), exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await mainWindow.getByRole("button", { name: "Albums" }).click();
    await expect(mainWindow.locator("main.main-panel").getByRole("heading", { name: "Albums" })).toBeVisible();

    await sidebar.getByRole("button", { name: "Insights", exact: true }).click();
    await sidebar.getByRole("button", { name: "Folder analysis status" }).click();

    const main = mainWindow.locator("main.main-panel");
    await expect(main.getByRole("button", { name: "Back to images", exact: true })).toBeVisible({
      timeout: 60_000,
    });

    const rotationCard = mainWindow.locator("section").filter({
      has: mainWindow.getByRole("heading", { name: "Wrongly rotated images" }),
    }).first();
    await rotationCard.getByRole("button", { name: "View wrongly rotated images" }).click();

    await expect(main.getByText("Include subfolders")).toBeVisible({ timeout: 15_000 });
    await expect(main.getByRole("article").filter({ hasText: "stays.jpg" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Albums", exact: true })).toBeHidden();
  });
});
