import { test, expect } from "../e2e/fixtures/app-fixture";

test.describe("Settings", () => {
  test("settings section renders configuration options", async ({ mainWindow }) => {
    await mainWindow.getByRole("navigation").getByText("Settings", { exact: true }).click();

    // Wait for settings to load — the section should have recognizable labels
    // These labels come from the DesktopSettingsSection component
    const settingsArea = mainWindow.locator("main.main-panel");
    await expect(settingsArea).toBeVisible();

    // Settings should no longer show the empty folder state
    await expect(mainWindow.getByText("Select a folder to view media")).not.toBeVisible();

    await settingsArea.locator("details summary").first().click();
    const dateFormatSelect = settingsArea.locator("select").first();
    await expect(dateFormatSelect).toBeVisible();
    await expect(dateFormatSelect.locator("option[value='DD.MM.YYYY']")).toHaveCount(1);
  });
});
