import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { openE2ePhotoLibrary, openFirstPhotoInViewer } from "./fixtures/e2e-photos-library";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const FACE_IMAGE = "face-detect-sample-01.jpg";
const NO_FACE_IMAGE = "receipt-mock-01-german.jpg";

test.describe("Viewer face-tags overlay regression", () => {
  test.setTimeout(600_000);

  test("switching to no-face image with Face tags tab open clears overlay boxes", async ({
    electronApp,
    mainWindow,
  }) => {
    const facePath = path.join(e2ePhotosDir, FACE_IMAGE);
    const noFacePath = path.join(e2ePhotosDir, NO_FACE_IMAGE);
    test.skip(!fs.existsSync(facePath) || !fs.existsSync(noFacePath), "Missing required E2E assets");

    // Ensure deterministic DB state for these two images
    await mainWindow.evaluate(async ({ facePath, noFacePath }) => {
      const settings = await window.desktopApi.getSettings();
      const faceDetection = { ...settings.faceDetection, detectorModel: "yolov12s-face" as const };
      await window.desktopApi.ensureDetectorModel("yolov12s-face");
      await window.desktopApi.detectFacesForMediaItem(facePath, faceDetection);
      await window.desktopApi.detectFacesForMediaItem(noFacePath, faceDetection);
    }, { facePath, noFacePath });

    await openE2ePhotoLibrary(electronApp, mainWindow);

    await openFirstPhotoInViewer(mainWindow);

    // Switch viewer to a known face image using the thumbnail strip.
    await mainWindow.locator(`.media-swiper-theme img[alt*="${FACE_IMAGE}"]`).first().click({
      force: true,
    });
    await expect(mainWindow.locator(".media-swiper-theme")).toBeVisible();

    await mainWindow.getByRole("button", { name: "Show info" }).click();

    // Open Face tags tab and verify overlay exists on face image
    await mainWindow.getByRole("button", { name: /Face tags/ }).click();
    await expect(mainWindow.getByText("No faces detected for this media item yet.")).not.toBeVisible();
    const faceOverlayRects = mainWindow.locator('div[style*="border-radius: 16"]');
    await expect(faceOverlayRects.first()).toBeVisible();

    // Switch to an image that has no faces while Face tags tab stays open
    await mainWindow.locator(`.media-swiper-theme img[alt*="${NO_FACE_IMAGE}"]`).first().click({
      force: true,
    });

    // Regression check: no stale overlays from previous image
    await expect(mainWindow.getByText("No faces detected for this media item yet.")).toBeVisible();
    await expect(faceOverlayRects).toHaveCount(0);
  });
});

