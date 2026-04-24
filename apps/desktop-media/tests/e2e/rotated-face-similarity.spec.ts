import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { waitForArcFaceModelReady } from "./fixtures/e2e-ai-ready";
import { openE2ePhotoLibrary } from "./fixtures/e2e-photos-library";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const BASE_FACE_FILE = "face-detect-sample-01.jpg";
const ROTATED_FACE_FILE = "20230810_141737.jpg";
const EXTRA_FACE_FILE = "IMG-20220802-WA0016.jpg";

function hasAssets(): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return [BASE_FACE_FILE, ROTATED_FACE_FILE, EXTRA_FACE_FILE].every((f) =>
    fs.existsSync(path.join(e2ePhotosDir, f)),
  );
}

test.describe("Rotated face similarity suggestion", () => {
  test.setTimeout(600_000);

  test("rotated and non-rotated group images show person-tag suggestion in Face tags tab", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!hasAssets(), `Missing required test assets in: ${e2ePhotosDir}`);

    await waitForArcFaceModelReady(mainWindow);
    await openE2ePhotoLibrary(electronApp, mainWindow);

    const baseFacePath = path.join(e2ePhotosDir, BASE_FACE_FILE);
    const rotatedFacePath = path.join(e2ePhotosDir, ROTATED_FACE_FILE);
    const extraFacePath = path.join(e2ePhotosDir, EXTRA_FACE_FILE);
    const personLabel = "E2E Rotated Similarity";

    const result = await mainWindow.evaluate(
      async ({ baseFacePath, rotatedFacePath, extraFacePath, personLabel }) => {
        const settings = await window.desktopApi.getSettings();
        const faceDetection = {
          ...settings.faceDetection,
          detectorModel: "yolov12l-face" as const,
          faceRecognitionSimilarityThreshold: 0.2,
          faceLandmarkRefinement: {
            ...settings.faceDetection.faceLandmarkRefinement,
            enabled: true,
          },
        };
        await window.desktopApi.ensureDetectorModel("yolov12l-face");
        await window.desktopApi.saveSettings({
          ...settings,
          wrongImageRotationDetection: {
            ...settings.wrongImageRotationDetection,
            enabled: true,
            useFaceLandmarkFeaturesFallback: true,
          },
          faceDetection,
        });

        const baseDetection = await window.desktopApi.detectFacesForMediaItem(
          baseFacePath,
          faceDetection,
        );
        const rotatedDetection = await window.desktopApi.detectFacesForMediaItem(
          rotatedFacePath,
          faceDetection,
        );
        const extraDetection = await window.desktopApi.detectFacesForMediaItem(
          extraFacePath,
          faceDetection,
        );
        if (!baseDetection.success || baseDetection.faceCount < 1) {
          return { ok: false as const, error: "No face detected in base image." };
        }
        if (!rotatedDetection.success || rotatedDetection.faceCount < 1) {
          return { ok: false as const, error: "No face detected in rotated image." };
        }
        if (!extraDetection.success || extraDetection.faceCount < 1) {
          return { ok: false as const, error: "No face detected in extra image." };
        }

        await window.desktopApi.reprocessFaceCropsAndEmbeddings();

        const byPath = await window.desktopApi.getMediaItemsByPaths([
          baseFacePath,
          rotatedFacePath,
          extraFacePath,
        ]);
        const baseMedia = byPath[baseFacePath];
        const rotatedMedia = byPath[rotatedFacePath];
        const extraMedia = byPath[extraFacePath];
        if (!baseMedia || !rotatedMedia || !extraMedia) {
          return { ok: false as const, error: "Unable to resolve media items." };
        }

        const orientation = (rotatedMedia.aiMetadata as {
          orientation_detection?: { correction_angle_clockwise?: unknown; source?: unknown };
        } | null | undefined)?.orientation_detection;
        const rotatedCorrectionAngle = orientation?.correction_angle_clockwise;
        const baseOrientation = (baseMedia.aiMetadata as {
          orientation_detection?: { correction_angle_clockwise?: unknown; source?: unknown };
        } | null | undefined)?.orientation_detection;
        const baseCorrectionAngle = baseOrientation?.correction_angle_clockwise;

        const baseFaces = await window.desktopApi.listFaceInstancesForMediaItem(baseMedia.id);
        const rotatedFaces = await window.desktopApi.listFaceInstancesForMediaItem(rotatedMedia.id);
        const extraFaces = await window.desktopApi.listFaceInstancesForMediaItem(extraMedia.id);
        if (baseFaces.length < 1 || rotatedFaces.length < 1 || extraFaces.length < 1) {
          return { ok: false as const, error: "Missing face instances after detection." };
        }

        const person = await window.desktopApi.createPersonTag(personLabel);
        const assigned = await window.desktopApi.assignPersonTagToFace(baseFaces[0].id, person.id);
        if (!assigned) {
          return { ok: false as const, error: "Failed to assign base face tag." };
        }

        await window.desktopApi.refreshPersonSuggestions();

        const suggestions = await Promise.all(
          rotatedFaces.map((face) =>
            window.desktopApi.suggestPersonTagForFace({
              faceInstanceId: face.id,
              threshold: faceDetection.faceRecognitionSimilarityThreshold,
            }),
          ),
        );
        const matched = suggestions.find((s) => s?.tagId === person.id) ?? null;
        const rotatedSimilarities = await window.desktopApi.getFaceToPersonCentroidSimilarities(
          rotatedFaces.map((face) => face.id),
          person.id,
        );

        const extraSuggestions = await Promise.all(
          extraFaces.map((face) =>
            window.desktopApi.suggestPersonTagForFace({
              faceInstanceId: face.id,
              threshold: faceDetection.faceRecognitionSimilarityThreshold,
            }),
          ),
        );
        const matchedExtra = extraSuggestions.find((s) => s?.tagId === person.id) ?? null;
        const extraSimilarities = await window.desktopApi.getFaceToPersonCentroidSimilarities(
          extraFaces.map((face) => face.id),
          person.id,
        );

        return {
          ok: true as const,
          personLabel,
          matched,
          matchedExtra,
          rotatedFaceCount: rotatedFaces.length,
          extraFaceCount: extraFaces.length,
          rotatedCorrectionAngle,
          baseCorrectionAngle,
          rotatedSimilarities,
          extraSimilarities,
        };
      },
      { baseFacePath, rotatedFacePath, extraFacePath, personLabel },
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.baseCorrectionAngle).toBe(0);
    expect(result.rotatedCorrectionAngle).toBe(270);
    expect(
      result.matched,
      `Expected at least one rotated face to get person-tag suggestion. Similarities: ${JSON.stringify(result.rotatedSimilarities)}`,
    ).toBeTruthy();
    expect(
      result.matchedExtra,
      "Expected at least one face in IMG-20220802-WA0016.jpg to get person-tag suggestion.",
    ).toBeTruthy();
    expect(result.rotatedFaceCount).toBeGreaterThan(0);
    expect(result.extraFaceCount).toBeGreaterThan(0);

    await mainWindow
      .locator(`main.main-panel img[alt*="${ROTATED_FACE_FILE}"]`)
      .first()
      .click({ force: true });
    await expect(mainWindow.locator(".media-swiper-theme")).toBeVisible({ timeout: 10_000 });
    await mainWindow.getByRole("button", { name: "Show info" }).click();
    await mainWindow.getByRole("button", { name: /Face tags/ }).click();
    await expect(mainWindow.getByText(new RegExp(`${result.personLabel}.*Similarity:`))).toBeVisible({
      timeout: 20_000,
    });
  });
});

