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
    const sidebar = mainDesktopSidebar(mainWindow);
    await expect(sidebar.getByText("Folders")).toBeVisible();
    await expect(sidebar.getByText("Albums")).toBeVisible();
    await expect(sidebar.getByText("People")).toBeVisible();
    await expect(sidebar.getByText("Documents")).toBeVisible();
    await expect(sidebar.getByText("Insights")).toBeVisible();
    await expect(sidebar.getByText("Settings")).toBeVisible();
  });
});
