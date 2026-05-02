import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

let testFolder: string;

test.use({ ollamaMock: { failFirstChatRequests: 8 } });

test.beforeAll(() => {
  testFolder = createTestImageFolder(8);
});

test.afterAll(() => {
  removeTestImageFolder(testFolder);
});

test.describe("Image AI analysis readiness", () => {
  test("does not mark early images failed while Ollama model warms up", async ({ electronApp, mainWindow }) => {
    await mockFolderDialog(electronApp, testFolder);
    await mainWindow.getByText("Add library folder").click();

    await clickSidebarLibraryRoot(mainWindow, testFolder);

    await mainWindow.evaluate(() => {
      // @ts-expect-error - attach for tests
      window.__e2ePhotoPipelineProgress = [];
      // @ts-expect-error
      window.__e2ePipelineLifecycle = [];
      // @ts-expect-error
      window.__e2eUnsubJob = window.desktopApi.pipelines.onJobProgress((e) => {
        if (e.pipelineId !== "photo-analysis") return;
        // @ts-expect-error
        window.__e2ePhotoPipelineProgress.push({
          processed: e.progress.processed,
          total: e.progress.total,
          message: e.progress.message,
          details: e.progress.details,
        });
      });
      // @ts-expect-error
      window.__e2eUnsubLife = window.desktopApi.pipelines.onLifecycle((e) => {
        // @ts-expect-error
        window.__e2ePipelineLifecycle.push(e);
      });
    });

    try {
      const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
      await actionsButton.click();

      const menu = mainWindow.locator(".desktop-actions-menu");
      const row = menu.locator(".photo-ai-row");
      await expect(row.getByText("Image AI analysis")).toBeVisible();
      await row.locator("button.face-detect-play-btn").click();

      await mainWindow.waitForFunction(
        () => {
          // @ts-expect-error
          const life = window.__e2ePipelineLifecycle ?? [];
          return life.some((e: { type: string }) => e.type === "bundle-finished");
        },
        { timeout: 120_000 },
      );

      const summary = await mainWindow.evaluate(() => {
        // @ts-expect-error
        const prog = window.__e2ePhotoPipelineProgress ?? [];
        let failedCount = 0;
        let successCount = 0;
        for (const row of prog) {
          const d = row.details;
          if (d && typeof d === "object" && d !== null && "path" in d && typeof (d as { path?: unknown }).path === "string") {
            const rec = d as { path: string; error?: unknown };
            if (typeof rec.error === "string" && rec.error.length > 0) {
              failedCount += 1;
            } else if (typeof row.message === "string" && row.message.startsWith("Analyzed:")) {
              successCount += 1;
            }
          }
        }
        // @ts-expect-error
        const life = window.__e2ePipelineLifecycle ?? [];
        const finished = life.find((e: { type: string }) => e.type === "bundle-finished") as
          | { type: string; state?: string }
          | undefined;
        return { failedCount, successCount, bundleState: finished?.state ?? null };
      });

      expect(summary.failedCount).toBe(0);
      expect(summary.successCount).toBeGreaterThan(0);
      expect(summary.bundleState).toBe("succeeded");
    } finally {
      await mainWindow.evaluate(() => {
        // @ts-expect-error
        window.__e2eUnsubJob?.();
        // @ts-expect-error
        window.__e2eUnsubLife?.();
      });
    }
  });
});
