import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot, mainDesktopSidebar } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

const REAL_IMAGE_FOLDER = path.resolve(__dirname, "../../test-assets-local/e2e-photos");

let tempFolder: string;

test.beforeAll(() => {
  tempFolder = createTestImageFolder(12);
});

test.afterAll(() => {
  removeTestImageFolder(tempFolder);
});

test.describe("Image AI analysis cancel", () => {
  test("cancelling immediately does not break folder browsing or leave analysis in-progress", async ({ electronApp, mainWindow }) => {
    // Add two libraries so we can switch after cancel.
    await mockFolderDialog(electronApp, tempFolder);
    await mainWindow.getByText("Add library folder").click();
    await mockFolderDialog(electronApp, REAL_IMAGE_FOLDER);
    await mainWindow.getByText("Add library folder").click();

    const sidebar = mainDesktopSidebar(mainWindow);
    await expect(
      sidebar.getByRole("button", { name: path.normalize(tempFolder), exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("button", { name: path.normalize(REAL_IMAGE_FOLDER), exact: true }),
    ).toBeVisible();

    await clickSidebarLibraryRoot(mainWindow, tempFolder);

    const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
    await actionsButton.click();

    const menu = mainWindow.locator(".desktop-actions-menu");
    const row = menu.locator(".photo-ai-row");
    await expect(row.getByText("Image AI analysis")).toBeVisible();

    // Start analysis (toolbar menu closes after start), then reopen and cancel immediately.
    const playPause = row.locator("button.face-detect-play-btn");
    await playPause.click();
    await actionsButton.click();
    const menuAfterStart = mainWindow.locator(".desktop-actions-menu");
    const rowAfterStart = menuAfterStart.locator(".photo-ai-row");
    await expect(rowAfterStart.getByText("Image AI analysis")).toBeVisible();
    await rowAfterStart.locator("button.face-detect-play-btn").click();

    // Ensure the app stays responsive by switching folders and loading thumbnails.
    await clickSidebarLibraryRoot(mainWindow, REAL_IMAGE_FOLDER);
    const thumbnails = mainWindow.locator("main.main-panel img[alt]");
    await expect(thumbnails.first()).toBeVisible({ timeout: 20_000 });

    // Ensure folder analysis status isn't stuck "in progress" for the temp folder.
    await mainWindow.waitForFunction(
      async (folderPath: string) => {
        const statuses = await window.desktopApi.getFolderAnalysisStatuses();
        const s = (statuses as any)[folderPath];
        return !s || s.state !== "in_progress";
      },
      tempFolder,
      { timeout: 30_000 },
    );
  });
});

