import { test, expect } from "./fixtures/app-fixture";

const BUNDLE_ID = "e2e-duplicate-scan-bundle";
const JOB_ID = "e2e-duplicate-scan-job";
const DISPLAY_NAME = "Check duplicate files - E2E mock folder";

function duplicateScanBundle(state: "running" | "succeeded" | "cancelled") {
  const now = Date.now();
  const isRunning = state === "running";
  return {
    bundleId: BUNDLE_ID,
    displayName: DISPLAY_NAME,
    state,
    enqueuedAt: now - 1_000,
    startedAt: now - 900,
    finishedAt: isRunning ? null : now,
    jobs: [
      {
        jobId: JOB_ID,
        pipelineId: "folder-duplicate-scan" as const,
        params: { folderPath: "E2E mock folder", recursive: true },
        state: isRunning ? ("running" as const) : state === "cancelled" ? ("cancelled" as const) : ("succeeded" as const),
        progress: {
          phase: isRunning ? "scanning" : "completed",
          processed: isRunning ? 12 : 100,
          total: 100,
          message: isRunning ? "Checking duplicates: e2e-photo.jpg" : "Done",
          details: null,
          lastUpdatedAt: now,
        },
        error: null,
        startedAt: now - 900,
        finishedAt: isRunning ? null : now,
      },
    ],
  };
}

test.describe("Duplicate files pipeline cancellation", () => {
  test("running duplicate scan X cancels the bundle; completed X dismisses the card", async ({
    electronApp,
    mainWindow,
  }) => {
    await electronApp.evaluate(({ BrowserWindow, ipcMain }) => {
      const cancelChannel = "pipelines:cancel-bundle";
      const queueChangedChannel = "pipelines:queue-changed";
      // @ts-expect-error E2E-only capture for assertion.
      globalThis.__e2eDuplicateScanCancelledBundles = [];

      ipcMain.removeHandler(cancelChannel);
      ipcMain.handle(cancelChannel, (_event, bundleId: string): boolean => {
        // @ts-expect-error E2E-only capture for assertion.
        globalThis.__e2eDuplicateScanCancelledBundles.push(bundleId);
        const now = Date.now();
        const cancelledSnapshot = {
          running: [],
          queued: [],
          recent: [
            {
              bundleId,
              displayName: "Check duplicate files - E2E mock folder",
              state: "cancelled",
              enqueuedAt: now - 1_000,
              startedAt: now - 900,
              finishedAt: now,
              jobs: [
                {
                  jobId: "e2e-duplicate-scan-job",
                  pipelineId: "folder-duplicate-scan",
                  params: { folderPath: "E2E mock folder", recursive: true },
                  state: "cancelled",
                  progress: {
                    phase: "scanning",
                    processed: 12,
                    total: 100,
                    message: "Cancelled",
                    details: null,
                    lastUpdatedAt: now,
                  },
                  error: null,
                  startedAt: now - 900,
                  finishedAt: now,
                },
              ],
            },
          ],
        };
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(queueChangedChannel, cancelledSnapshot);
        }
        return true;
      });
    });

    await mainWindow.evaluate((bundle) => {
      return window.desktopApi.pipelines.e2ePushQueueSnapshot({
        running: [bundle],
        queued: [],
        recent: [],
      });
    }, duplicateScanBundle("running"));

    const pipelineQueue = mainWindow.getByLabel("Pipeline queue");
    await expect(pipelineQueue).toBeVisible();
    await expect(pipelineQueue.getByRole("heading", { name: DISPLAY_NAME })).toBeVisible();

    await pipelineQueue.getByRole("button", { name: `Cancel ${DISPLAY_NAME}` }).click();

    await expect(pipelineQueue.getByRole("heading", { name: DISPLAY_NAME })).toBeHidden();
    await expect
      .poll(() =>
        electronApp.evaluate(() => {
          // @ts-expect-error E2E-only capture for assertion.
          return globalThis.__e2eDuplicateScanCancelledBundles as string[];
        }),
      )
      .toContainEqual(BUNDLE_ID);

    await mainWindow.evaluate((bundle) => {
      return window.desktopApi.pipelines.e2ePushQueueSnapshot({
        running: [],
        queued: [],
        recent: [bundle],
      });
    }, duplicateScanBundle("succeeded"));

    const completedToggle = pipelineQueue.getByRole("button", { name: /Completed \(1\)/ });
    await expect(completedToggle).toBeVisible();
    await completedToggle.click();
    await expect(pipelineQueue.getByRole("heading", { name: DISPLAY_NAME })).toBeVisible();

    await pipelineQueue.getByRole("button", { name: `Dismiss ${DISPLAY_NAME}` }).click();
    await expect(pipelineQueue.getByRole("heading", { name: DISPLAY_NAME })).toBeHidden();
  });
});
