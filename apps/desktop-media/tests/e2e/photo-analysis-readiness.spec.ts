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

    // Collect progress events in the renderer.
    await mainWindow.evaluate(() => {
      // @ts-expect-error - attach for tests
      window.__e2ePhotoEvents = [];
      // @ts-expect-error - attach for tests
      window.__e2ePhotoUnsub = window.desktopApi.onPhotoAnalysisProgress((e) => {
        // @ts-expect-error - attach for tests
        window.__e2ePhotoEvents.push(e);
      });
    });

    const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
    await actionsButton.click();

    // Start analysis via the play button on the "Image AI analysis" row.
    const menu = mainWindow.locator(".desktop-actions-menu");
    const row = menu.locator(".photo-ai-row");
    await expect(row.getByText("Image AI analysis")).toBeVisible();
    await row.locator("button.face-detect-play-btn").click();

    // Wait for job completion.
    await mainWindow.waitForFunction(() => {
      // @ts-expect-error - attached in test
      const events = window.__e2ePhotoEvents ?? [];
      return events.some((e: any) => e && e.type === "job-completed");
    }, { timeout: 60_000 });

    const summary = await mainWindow.evaluate(() => {
      // @ts-expect-error - attached in test
      const events = window.__e2ePhotoEvents ?? [];
      const failed = events.filter((e: any) => e?.type === "item-updated" && e?.item?.status === "failed");
      const success = events.filter((e: any) => e?.type === "item-updated" && e?.item?.status === "success");
      const completed = events.find((e: any) => e?.type === "job-completed");
      return {
        failedCount: failed.length,
        successCount: success.length,
        completed: completed ? { failed: completed.failed, completed: completed.completed, cancelled: completed.cancelled } : null,
      };
    });

    expect(summary.failedCount).toBe(0);
    expect(summary.successCount).toBeGreaterThan(0);
    expect(summary.completed?.failed ?? 0).toBe(0);

    await mainWindow.evaluate(() => {
      // @ts-expect-error - attached in test
      window.__e2ePhotoUnsub?.();
    });
  });
});

