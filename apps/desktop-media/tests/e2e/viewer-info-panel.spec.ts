import { test, expect } from "./fixtures/app-fixture";
import { openE2ePhotoLibrary, openFirstPhotoInViewer } from "./fixtures/e2e-photos-library";

const PHOTO_WITH_CAPTURE_DATE = "20200910_151932.jpg";

async function openPhotoInViewerByName(
  mainWindow: import("@playwright/test").Page,
  filename: string,
): Promise<void> {
  const thumbnail = mainWindow.locator(`main.main-panel img[alt*="${filename}"]`).first();
  await expect(thumbnail).toBeVisible({ timeout: 15_000 });
  await thumbnail.locator("xpath=../..").click();
  await expect(mainWindow.locator(".media-swiper-theme")).toBeVisible({ timeout: 5_000 });
}

test.describe("Viewer info panel (e2e-photos)", () => {
  test("Info tab shows catalog metadata on first open without visiting Face tags", async ({
    electronApp,
    mainWindow,
  }) => {
    await openE2ePhotoLibrary(electronApp, mainWindow);
    await openPhotoInViewerByName(mainWindow, PHOTO_WITH_CAPTURE_DATE);

    await mainWindow.getByRole("button", { name: "Show info" }).click();

    const unavailable = mainWindow.getByText("Metadata is not available yet for this file.");
    await expect(unavailable).not.toBeVisible({ timeout: 60_000 });

    await mainWindow
      .locator("details")
      .filter({ has: mainWindow.locator(".desktop-info-section-title", { hasText: "Image file data" }) })
      .locator("summary")
      .click();

    await expect(mainWindow.locator(".desktop-info-section-title", { hasText: "Image file data" })).toBeVisible();
    await expect(
      mainWindow.locator(".desktop-info-field").filter({ has: mainWindow.locator("dt", { hasText: "Filename" }) }),
    ).toBeVisible();

    await mainWindow
      .locator("details")
      .filter({ has: mainWindow.locator(".desktop-info-section-title", { hasText: "Image capture data" }) })
      .locator("summary")
      .click();

    const dateTakenField = mainWindow
      .locator(".desktop-info-field")
      .filter({ has: mainWindow.locator("dt", { hasText: "Date taken" }) });
    await expect(dateTakenField).toBeVisible();
    await expect(dateTakenField.locator("dd")).toHaveText(/\S+/);
  });

  test("Info tab stays populated after opening Face tags then returning to Info", async ({
    electronApp,
    mainWindow,
  }) => {
    await openE2ePhotoLibrary(electronApp, mainWindow);
    await openFirstPhotoInViewer(mainWindow);

    await mainWindow.getByRole("button", { name: "Show info" }).click();
    await expect(
      mainWindow.getByText("Metadata is not available yet for this file."),
    ).not.toBeVisible({ timeout: 60_000 });

    await mainWindow.getByRole("button", { name: "Face tags", exact: true }).click();
    await mainWindow.getByRole("button", { name: "Info", exact: true }).click();

    await expect(
      mainWindow.getByText("Metadata is not available yet for this file."),
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(mainWindow.locator(".desktop-info-section-title", { hasText: "Image file data" })).toBeVisible();
  });

  test("Close info panel control restores Show info in the viewer toolbar", async ({ electronApp, mainWindow }) => {
    await openE2ePhotoLibrary(electronApp, mainWindow);
    await openFirstPhotoInViewer(mainWindow);

    await mainWindow.getByRole("button", { name: "Show info" }).click();
    await expect(mainWindow.getByRole("button", { name: "Close info panel" })).toBeVisible();

    await mainWindow.getByRole("button", { name: "Close info panel" }).click();
    await expect(mainWindow.getByRole("button", { name: "Show info" })).toBeVisible();
  });
});
