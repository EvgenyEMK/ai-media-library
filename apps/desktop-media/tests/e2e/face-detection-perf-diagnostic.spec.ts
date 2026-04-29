import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";

function listImages(folderPath: string, limit: number): string[] {
  if (!fs.existsSync(folderPath)) return [];
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((ent) => ent.isFile() && /\.(jpe?g|png|webp|heic|heif)$/i.test(ent.name))
    .map((ent) => path.join(folderPath, ent.name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))
    .slice(0, limit);
}

test.describe("Face detection perf diagnostic", () => {
  test.setTimeout(900_000);

  test("measure per-image latency on 2022 Geneva appartment and 2022 Skiing", async ({
    mainWindow,
  }) => {
    const detectorModel =
      (process.env.EMK_FACE_PERF_MODEL as "yolov12s-face" | "retinaface" | undefined) ??
      "yolov12s-face";
    const folders = [
      "C:\\EMK-Media\\2022\\2022 Geneva appartment",
      "C:\\EMK-Media\\2022\\2022 Skiing",
    ];
    const samples = folders.map((folder) => ({
      folder,
      images: listImages(folder, 13),
    }));
    const missing = samples.filter((s) => s.images.length === 0).map((s) => s.folder);
    test.skip(
      missing.length > 0,
      `Diagnostic assets missing: ${missing.join(", ")}. Mount local media folders to run this test.`,
    );

    for (const sample of samples) {
      expect(
        sample.images.length,
        `No images found in ${sample.folder}. Update path or mount data before running diagnostic.`,
      ).toBeGreaterThan(0);
    }

    const appliedSettings = await mainWindow.evaluate(async (selectedModel) => {
      const settings = await window.desktopApi.getSettings();
      const nextSettings = {
        ...settings,
        wrongImageRotationDetection: {
          ...settings.wrongImageRotationDetection,
          enabled: false,
        },
        faceDetection: {
          ...settings.faceDetection,
          detectorModel: selectedModel,
          faceLandmarkRefinement: {
            ...settings.faceDetection.faceLandmarkRefinement,
            enabled: false,
          },
          faceAgeGenderDetection: {
            ...settings.faceDetection.faceAgeGenderDetection,
            enabled: false,
          },
        },
      };
      await window.desktopApi.saveSettings(nextSettings);
      const ensured = await window.desktopApi.ensureDetectorModel(selectedModel);
      if (!ensured.success) {
        throw new Error(
          `ensureDetectorModel(${selectedModel}) failed: ${ensured.error ?? "unknown"}`,
        );
      }
      const updated = await window.desktopApi.getSettings();
      return {
        detectorModel: updated.faceDetection.detectorModel,
        landmarkEnabled: updated.faceDetection.faceLandmarkRefinement.enabled,
        ageGenderEnabled: updated.faceDetection.faceAgeGenderDetection.enabled,
        rotationEnabled: updated.wrongImageRotationDetection.enabled,
      };
    }, detectorModel);
    console.log(`[face-perf] applied-settings ${JSON.stringify(appliedSettings)}`);

    for (const sample of samples) {
      console.log(
        `\n[face-perf] model=${detectorModel} folder=${sample.folder} images=${sample.images.length}`,
      );
      for (const imagePath of sample.images) {
        const result = await mainWindow.evaluate(async (p) => {
          const t0 = performance.now();
          const settings = await window.desktopApi.getSettings();
          const out = (await window.desktopApi.detectFacesForMediaItem(p, settings.faceDetection)) as {
            success: boolean;
            faceCount: number;
            debugTimings?: {
              totalMs: number;
              precheckMs: number;
              detectMs: number;
              embedMs: number;
            };
          };
          const elapsedMs = performance.now() - t0;
          return { elapsedMs, out };
        }, imagePath);

        const sec = (result.elapsedMs / 1000).toFixed(2);
        const faceCount = result.out.success ? result.out.faceCount : -1;
        const ok = result.out.success ? "ok" : "fail";
        const timing = result.out.debugTimings;
        const timingSuffix = timing
          ? ` totalMs=${timing.totalMs} precheckMs=${timing.precheckMs} detectMs=${timing.detectMs} embedMs=${timing.embedMs}`
          : "";
        console.log(
          `[face-perf] ${ok} elapsed=${sec}s faces=${faceCount}${timingSuffix} file=${path.basename(imagePath)}`,
        );
      }
    }
  });
});
