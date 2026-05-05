import { test, expect } from "../e2e/fixtures/app-fixture";

test.describe("Settings", () => {
  test("settings section renders configuration options", async ({ mainWindow }) => {
    await mainWindow.getByText("Settings").click();

    // Wait for settings to load — the section should have recognizable labels
    // These labels come from the DesktopSettingsSection component
    const settingsArea = mainWindow.locator("main.main-panel");
    await expect(settingsArea).toBeVisible();

    // Settings should no longer show the empty folder state
    await expect(mainWindow.getByText("Select a folder to view media")).not.toBeVisible();
    await expect(mainWindow.getByText("Date format")).toBeVisible();
    await expect(mainWindow.locator("select").filter({ hasText: "DD.MM.YYYY" }).first()).toBeVisible();
  });
});
