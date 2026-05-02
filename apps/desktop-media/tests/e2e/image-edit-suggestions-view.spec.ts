import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const ROTATED_ASSET = "rotated-bw-01.jpg";

test.describe("Image edit suggestions metadata", () => {
  test.setTimeout(600_000);

  test("retains orientation_detection after photo analysis overwrite", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!fs.existsSync(path.join(e2ePhotosDir, ROTATED_ASSET)), `Missing ${ROTATED_ASSET}`);
    const rotatedPath = path.join(e2ePhotosDir, ROTATED_ASSET);

    const faceDetectionForDetect = await mainWindow.evaluate(async () => {
      const settings = await window.desktopApi.getSettings();
      await window.desktopApi.ensureAuxModel(
        "orientation",
        settings.faceDetection.imageOrientationDetection.model,
      );
      const faceDetection = {
        ...settings.faceDetection,
        detectorModel: "yolov12s-face" as const,
      };
      await window.desktopApi.saveSettings({
        ...settings,
        wrongImageRotationDetection: {
          ...settings.wrongImageRotationDetection,
          enabled: true,
          useFaceLandmarkFeaturesFallback: true,
        },
        faceDetection,
      });
      const ensured = await window.desktopApi.ensureDetectorModel("yolov12s-face");
      if (!ensured.success) {
        throw new Error(`ensureDetectorModel(yolov12s-face): ${ensured.error ?? "unknown"}`);
      }
      return faceDetection;
    });

    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    const detectResult = await mainWindow.evaluate(
      async ({ sourcePath, faceDetection }) =>
        window.desktopApi.detectFacesForMediaItem(sourcePath, faceDetection),
      { sourcePath: rotatedPath, faceDetection: faceDetectionForDetect },
    );
    expect(detectResult.success).toBe(true);

    const hasOrientationDetection = await mainWindow.evaluate(async (sourcePath) => {
      const items = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
      const item = items[sourcePath];
      const orientation =
        (item?.aiMetadata as { orientation_detection?: Record<string, unknown> } | undefined)
          ?.orientation_detection ?? null;
      const angle = orientation?.correction_angle_clockwise;
      return angle === 90 || angle === 180 || angle === 270;
    }, rotatedPath);
    expect(hasOrientationDetection).toBe(true);

    const afterPhotoAnalysis = await mainWindow.evaluate(async ({ sourcePath, folderPath }) => {
      const items = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
      const item = items[sourcePath];
      if (!item) {
        return false;
      }
      await window.desktopApi.analyzeFolderPhotos({
        folderPath,
        recursive: false,
        overrideExisting: true,
      });
      const start = Date.now();
      while (Date.now() - start < 240_000) {
        const snapshot = await window.desktopApi.pipelines.getSnapshot();
        const runningPhoto = snapshot.running.some((bundle) =>
          bundle.jobs.some((job) => job.pipelineId === "photo-analysis" && job.state === "running"),
        );
        if (!runningPhoto) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      const refreshed = (await window.desktopApi.getMediaItemsByPaths([sourcePath]))[sourcePath];
      const orientation =
        (refreshed?.aiMetadata as { orientation_detection?: Record<string, unknown> } | undefined)
          ?.orientation_detection ?? null;
      const angle = orientation?.correction_angle_clockwise;
      return angle === 90 || angle === 180 || angle === 270;
    }, { sourcePath: rotatedPath, folderPath: e2ePhotosDir });
    expect(afterPhotoAnalysis).toBe(true);
  });
});

