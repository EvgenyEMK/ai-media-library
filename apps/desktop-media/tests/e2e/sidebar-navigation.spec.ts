import { test, expect } from "../e2e/fixtures/app-fixture";
import { mainDesktopSidebar } from "../e2e/fixtures/desktop-sidebar";

test.describe("Sidebar navigation", () => {
  test("clicking People section hides the default empty state", async ({ mainWindow }) => {
    await mainWindow.getByText("People").click();
    await expect(mainWindow.locator(".empty-state")).not.toBeVisible();
  });

  test("clicking Settings section hides the default media area", async ({ mainWindow }) => {
    await mainWindow.getByText("Settings").click();
    // Settings replaces the media area — empty-state should be gone
    await expect(mainWindow.locator(".empty-state")).not.toBeVisible();
  });

  test("switching back to Folders restores the default empty state", async ({ mainWindow }) => {
    await mainWindow.getByText("Settings").click();
    await expect(mainWindow.locator(".empty-state")).not.toBeVisible();

    await mainWindow.getByRole("button", { name: "Folders" }).click();
    await expect(mainWindow.locator(".empty-state")).toBeVisible();
  });

  test("sidebar collapse toggle works", async ({ mainWindow }) => {
    const sidebar = mainDesktopSidebar(mainWindow);
    await expect(sidebar).not.toHaveClass(/w-\[84px\]/);

    const collapseButton = mainWindow.getByRole("button", { name: "Collapse" });
    await collapseButton.click();
    await expect(sidebar).toHaveClass(/w-\[84px\]/);

    const expandButton = mainWindow.getByRole("button", { name: "Expand" });
    await expandButton.click();
    await expect(sidebar).not.toHaveClass(/w-\[84px\]/);
  });
});
