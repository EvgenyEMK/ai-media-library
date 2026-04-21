import { test, expect } from "./fixtures/app-fixture";
import { openE2ePhotoLibrary } from "./fixtures/e2e-photos-library";

test.describe("Face model download failure handling", () => {
  test.setTimeout(180_000);

  test("shows failure message in Background operations when model download fails", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(
      process.env.EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD !== "1",
      "Run this test with EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD=1",
    );

    await openE2ePhotoLibrary(electronApp, mainWindow);

    const result = await mainWindow.evaluate(async () => {
      return window.desktopApi.ensureDetectorModel("yolov12m-face");
    });
    expect(result.success).toBe(false);

    // Failure should surface to renderer state and be visible in the operations area.
    await expect(
      mainWindow.getByText("Failed to download face detector model (yolov12m-face)."),
    ).toBeVisible({ timeout: 10_000 });
  });
});

