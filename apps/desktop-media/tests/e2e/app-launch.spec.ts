import { test, expect } from "../e2e/fixtures/app-fixture";
import { mainDesktopSidebar } from "../e2e/fixtures/desktop-sidebar";

test.describe("App launch", () => {
  test("renders the main shell with sidebar and content area", async ({ mainWindow }) => {
    const sidebar = mainDesktopSidebar(mainWindow);
    await expect(sidebar).toBeVisible();

    const mainPanel = mainWindow.locator("main.main-panel");
    await expect(mainPanel).toBeVisible();
  });

  test("shows empty state prompting folder selection", async ({ mainWindow }) => {
    await expect(mainWindow.locator(".empty-state")).toBeVisible();
  });

  test("displays all sidebar section labels", async ({ mainWindow }) => {
    await expect(mainWindow.getByText("Folders")).toBeVisible();
    await expect(mainWindow.getByText("Albums")).toBeVisible();
    await expect(mainWindow.getByText("People")).toBeVisible();
    await expect(mainWindow.getByText("Settings")).toBeVisible();
  });
});
