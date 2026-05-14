import { test, expect } from "../e2e/fixtures/app-fixture";

/** Must match `UI_TEXT.fileMetadataManagement` in `DesktopSettingsSection.tsx`. */
const SETTINGS_FILE_METADATA_SECTION_TITLE = "Folder scanning, file metadata and Geo-location";

test.describe("Settings", () => {
  test("settings section renders configuration options", async ({ mainWindow }) => {
    await mainWindow.getByRole("navigation").getByText("Settings", { exact: true }).click();

    // Wait for settings to load — the section should have recognizable labels
    // These labels come from the DesktopSettingsSection component
    const settingsArea = mainWindow.locator("main.main-panel");
    await expect(settingsArea).toBeVisible();

    // Settings should no longer show the empty folder state
    await expect(mainWindow.getByText("Select a folder to view media")).not.toBeVisible();

    /** Settings cards are `<details>`; body content is hidden until the section is opened. */
    await settingsArea.getByText(SETTINGS_FILE_METADATA_SECTION_TITLE, { exact: true }).click();

    await expect(settingsArea.getByText("After adding a media library root folder, start a full metadata scan")).toBeVisible();

    await settingsArea.locator("details summary").first().click();
    const dateFormatSelect = settingsArea.locator("select").first();
    await expect(dateFormatSelect).toBeVisible();
    await expect(dateFormatSelect.locator("option[value='DD.MM.YYYY']")).toHaveCount(1);
  });
});
