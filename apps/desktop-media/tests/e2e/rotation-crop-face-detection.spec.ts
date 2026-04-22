import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Jimp } from "jimp";
import { test, expect } from "./fixtures/app-fixture";

const sourceDir = path.resolve(__dirname, "../../test-assets-local/rotation-crop");
const media05 = path.join(sourceDir, "media05.jpg");
const media06 = path.join(sourceDir, "media06.jpg");

let tempDir = "";
let media05Corrected = "";
let media06Corrected = "";

async function writeRotatedCopy(
  sourcePath: string,
  destPath: string,
  angleClockwise: 90 | 180 | 270,
): Promise<void> {
  const image = await Jimp.read(sourcePath);
  const jimpRotationDegrees =
    angleClockwise === 90 ? 270 : angleClockwise === 270 ? 90 : 180;
  image.rotate(jimpRotationDegrees);
  await image.write(destPath as `${string}.jpg`);
}

test.beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-rotation-crop-"));
  media05Corrected = path.join(tempDir, "media05-corrected.jpg");
  media06Corrected = path.join(tempDir, "media06-corrected.jpg");
  await writeRotatedCopy(media05, media05Corrected, 90);
  await writeRotatedCopy(media06, media06Corrected, 270);
});

test.afterAll(() => {
  if (!tempDir) return;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function detectFaceCount(
  mainWindow: import("@playwright/test").Page,
  model: "yolov12s-face" | "yolov12l-face",
  imagePath: string,
): Promise<{ faceCount: number; orientationAngle: number | null; orientationSource: string | null }> {
  const result = await mainWindow.evaluate(async ({ model, imagePath }) => {
    const settings = await window.desktopApi.getSettings();
    await window.desktopApi.ensureDetectorModel(model);
    await window.desktopApi.ensureAuxModel(
      "orientation",
      settings.faceDetection.imageOrientationDetection.model,
    );
    await window.desktopApi.saveSettings({
      ...settings,
      wrongImageRotationDetection: {
        ...settings.wrongImageRotationDetection,
        enabled: true,
        useFaceLandmarkFeaturesFallback: true,
      },
      faceDetection: {
        ...settings.faceDetection,
        detectorModel: model,
      },
    });
    const run = await window.desktopApi.detectFacesForMediaItem(imagePath, {
      ...settings.faceDetection,
      detectorModel: model,
    });
    const byPath = await window.desktopApi.getMediaItemsByPaths([imagePath]);
    const item = byPath[imagePath];
    const orientation =
      (item?.aiMetadata as { orientation_detection?: Record<string, unknown> } | undefined)
        ?.orientation_detection ?? null;
    const angleRaw = orientation?.correction_angle_clockwise;
    const sourceRaw = orientation?.source;
    return {
      faceCount: run.success ? run.faceCount : -1,
      orientationAngle:
        angleRaw === 0 || angleRaw === 90 || angleRaw === 180 || angleRaw === 270 ? angleRaw : null,
      orientationSource: typeof sourceRaw === "string" ? sourceRaw : null,
    };
  }, { model, imagePath });
  return result;
}

test.describe("Rotation-crop face detection", () => {
  test.setTimeout(600_000);

  test("YOLO12s detects faces on rotated originals after orientation precheck", async ({ mainWindow }) => {
    test.skip(!fs.existsSync(media05) || !fs.existsSync(media06), "rotation-crop assets not found");

    const media05Count = await detectFaceCount(mainWindow, "yolov12s-face", media05);
    const media06Count = await detectFaceCount(mainWindow, "yolov12s-face", media06);
    const media05CorrectedCount = await detectFaceCount(mainWindow, "yolov12s-face", media05Corrected);
    const media06CorrectedCount = await detectFaceCount(mainWindow, "yolov12s-face", media06Corrected);
    expect(media05Count.faceCount).toBeGreaterThanOrEqual(1);
    expect(media06Count.faceCount).toBeGreaterThanOrEqual(1);
    expect(media05CorrectedCount.faceCount).toBeGreaterThanOrEqual(1);
    expect(media06CorrectedCount.faceCount).toBeGreaterThanOrEqual(1);
  });

  test("YOLO12l detects expected multi-face case on media06", async ({ mainWindow }) => {
    test.skip(!fs.existsSync(media05) || !fs.existsSync(media06), "rotation-crop assets not found");

    const media05Count = await detectFaceCount(mainWindow, "yolov12l-face", media05);
    const media06Count = await detectFaceCount(mainWindow, "yolov12l-face", media06);
    const media05CorrectedCount = await detectFaceCount(mainWindow, "yolov12l-face", media05Corrected);
    const media06CorrectedCount = await detectFaceCount(mainWindow, "yolov12l-face", media06Corrected);
    expect(media05Count.faceCount).toBeGreaterThanOrEqual(1);
    expect(media06Count.faceCount).toBeGreaterThanOrEqual(2);
    expect(media05CorrectedCount.faceCount).toBeGreaterThanOrEqual(1);
    expect(media06CorrectedCount.faceCount).toBeGreaterThanOrEqual(2);
  });
});

