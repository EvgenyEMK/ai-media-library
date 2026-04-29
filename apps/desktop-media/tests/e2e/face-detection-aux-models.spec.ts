import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const FACE_ASSET = "face-detect-sample-01.jpg";
const ROTATED_ASSET = "rotated-bw-01.jpg";

function assetsPresent(...files: string[]): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return files.every((f) => fs.existsSync(path.join(e2ePhotosDir, f)));
}

test.describe("Face detection — Phase 1 auxiliary models (orientation, landmarks, age/gender)", () => {
  test.setTimeout(900_000);

  test.skip(
    process.env.EMK_E2E_SKIP_YOLO_FACE === "1",
    "Set EMK_E2E_SKIP_YOLO_FACE=0 or unset to run (downloads aux ONNX models on first run).",
  );

  test("YOLO12s + PFLD + orientation + age/gender populate face instances and rotation suggestion", async ({
    mainWindow,
  }) => {
    test.skip(!assetsPresent(FACE_ASSET, ROTATED_ASSET), `Missing assets under ${e2ePhotosDir}`);

    const facePath = path.join(e2ePhotosDir, FACE_ASSET);
    const rotatedPath = path.join(e2ePhotosDir, ROTATED_ASSET);

    const result = await mainWindow.evaluate(
      async ({ facePath, rotatedPath }) => {
        const settings = await window.desktopApi.getSettings();
        const faceDetection = {
          ...settings.faceDetection,
          detectorModel: "yolov12s-face" as const,
          faceLandmarkRefinement: {
            ...settings.faceDetection.faceLandmarkRefinement,
            enabled: true,
          },
          faceAgeGenderDetection: {
            ...settings.faceDetection.faceAgeGenderDetection,
            enabled: true,
          },
        };
        await window.desktopApi.saveSettings({
          ...settings,
          faceDetection,
          wrongImageRotationDetection: {
            ...settings.wrongImageRotationDetection,
            enabled: true,
            useFaceLandmarkFeaturesFallback: true,
          },
        });

        const ensureDetector = await window.desktopApi.ensureDetectorModel("yolov12s-face");
        if (!ensureDetector.success) {
          return { ok: false as const, error: `ensureDetector: ${ensureDetector.error ?? "?"}` };
        }
        for (const [kind, id] of [
          ["orientation", faceDetection.imageOrientationDetection.model],
          ["landmarks", faceDetection.faceLandmarkRefinement.model],
          ["age-gender", faceDetection.faceAgeGenderDetection.model],
        ] as const) {
          const r = await window.desktopApi.ensureAuxModel(kind, id as never);
          if (!r.success) {
            return { ok: false as const, error: `ensureAux(${kind}/${id}): ${r.error ?? "?"}` };
          }
        }

        const faceRun = await window.desktopApi.detectFacesForMediaItem(facePath, faceDetection);
        if (!faceRun.success || faceRun.faceCount < 1) {
          return {
            ok: false as const,
            error: `face detection on ${facePath}: success=${faceRun.success} count=${faceRun.faceCount}`,
          };
        }
        const rotatedRun = await window.desktopApi.detectFacesForMediaItem(
          rotatedPath,
          faceDetection,
        );
        if (!rotatedRun.success) {
          return {
            ok: false as const,
            error: `face detection on ${rotatedPath}: success=false`,
          };
        }

        const metaByPath = await window.desktopApi.getMediaItemsByPaths([facePath, rotatedPath]);
        const faceMeta = metaByPath[facePath];
        const rotatedMeta = metaByPath[rotatedPath];
        if (!faceMeta || !rotatedMeta) {
          return { ok: false as const, error: "missing media item metadata" };
        }

        const faceInstances = await window.desktopApi.listFaceInstancesForMediaItem(faceMeta.id);
        return {
          ok: true as const,
          faceInstances,
          rotatedAiMetadata: rotatedMeta.aiMetadata,
        };
      },
      { facePath, rotatedPath },
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.faceInstances.length).toBeGreaterThan(0);
    const first = result.faceInstances[0];
    expect(first.landmarks_5, "PFLD should populate 5 landmarks").not.toBeNull();
    expect(first.landmarks_5?.length).toBe(5);
    expect(
      first.estimated_age_years,
      "age/gender model should populate age on a clear face",
    ).not.toBeNull();
    expect(first.estimated_gender).toMatch(/^(male|female)$/);
    expect(first.age_gender_confidence).toBeGreaterThan(0);

    const orientationDetection = (result.rotatedAiMetadata as {
      orientation_detection?: {
        source?: string;
        correction_angle_clockwise?: number;
      };
    })?.orientation_detection;
    expect(orientationDetection?.source).toBe("image-orientation-classifier");
    expect([90, 180, 270]).toContain(orientationDetection?.correction_angle_clockwise);
  });

  test("orientation precheck is skipped when already processed (face -> semantic)", async ({
    mainWindow,
  }) => {
    test.skip(!assetsPresent(ROTATED_ASSET), `Missing assets under ${e2ePhotosDir}`);
    const rotatedPath = path.join(e2ePhotosDir, ROTATED_ASSET);

    const result = await mainWindow.evaluate(async ({ rotatedPath, e2ePhotosDir }) => {
      const settings = await window.desktopApi.getSettings();
      await window.desktopApi.saveSettings({
        ...settings,
        wrongImageRotationDetection: {
          ...settings.wrongImageRotationDetection,
          enabled: true,
          useFaceLandmarkFeaturesFallback: true,
        },
      });

      const firstRun = await window.desktopApi.detectFacesForMediaItem(rotatedPath);
      if (!firstRun.success) {
        return { ok: false as const, error: "face detection failed" };
      }
      const metaAfterFace = (await window.desktopApi.getMediaItemsByPaths([rotatedPath]))[rotatedPath];
      const firstProcessedAt = (metaAfterFace?.aiMetadata as { orientation_detection?: { processed_at?: string } })
        ?.orientation_detection?.processed_at;
      if (!firstProcessedAt) {
        return { ok: false as const, error: "orientation_detection.processed_at missing after face run" };
      }

      await window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath: e2ePhotosDir,
        mode: "missing",
        recursive: false,
      });

      const start = Date.now();
      while (Date.now() - start < 120_000) {
        const snapshot = await window.desktopApi.pipelines.getSnapshot();
        const runningSemantic = snapshot.running.some((bundle) =>
          bundle.jobs.some((job) => job.pipelineId === "semantic-index" && job.state === "running"),
        );
        if (!runningSemantic) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const metaAfterSemantic = (await window.desktopApi.getMediaItemsByPaths([rotatedPath]))[rotatedPath];
      const secondProcessedAt = (metaAfterSemantic?.aiMetadata as { orientation_detection?: { processed_at?: string } })
        ?.orientation_detection?.processed_at;
      return {
        ok: true as const,
        firstProcessedAt,
        secondProcessedAt: secondProcessedAt ?? null,
      };
    }, { rotatedPath, e2ePhotosDir });

    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.secondProcessedAt).toBe(result.firstProcessedAt);
  });
});
