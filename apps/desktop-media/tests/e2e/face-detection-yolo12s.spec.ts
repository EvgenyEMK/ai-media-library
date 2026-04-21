import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const expectationsPath = path.join(defaultAssetsDir, "expectations.json");

interface YoloFaceExpectations {
  requiredFiles: string[];
}

function loadYoloFaceExpectations(): YoloFaceExpectations | null {
  if (!fs.existsSync(expectationsPath)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(expectationsPath, "utf-8")) as {
      yoloFaceDetection?: YoloFaceExpectations;
    };
    return raw.yoloFaceDetection ?? null;
  } catch {
    return null;
  }
}

function allRequiredFilesPresent(exp: YoloFaceExpectations): boolean {
  if (!fs.existsSync(e2ePhotosDir)) {
    return false;
  }
  return exp.requiredFiles.every((name) => fs.existsSync(path.join(e2ePhotosDir, name)));
}

test.describe("Face detection — YOLOv12 Small (ONNX)", () => {
  test.setTimeout(600_000);

  test("settings: YOLO12 Small, then detectFacesForMediaItem returns faces on people images", async ({
    mainWindow,
  }) => {
    test.skip(
      process.env.EMK_E2E_SKIP_YOLO_FACE === "1",
      "Set EMK_E2E_SKIP_YOLO_FACE=0 or unset to run (downloads ONNX on first run).",
    );

    const expectations = loadYoloFaceExpectations();
    test.skip(!expectations, "Missing yoloFaceDetection in expectations.json");
    test.skip(!allRequiredFilesPresent(expectations!), `Missing assets under ${e2ePhotosDir}`);

    const exp = expectations!;
    const fullPaths = exp.requiredFiles.map((f) => path.join(e2ePhotosDir, f));

    const result = await mainWindow.evaluate(async (paths: string[]) => {
      const settings = await window.desktopApi.getSettings();
      const faceDetection = {
        ...settings.faceDetection,
        detectorModel: "yolov12s-face" as const,
      };
      await window.desktopApi.saveSettings({ ...settings, faceDetection });

      const ensured = await window.desktopApi.ensureDetectorModel("yolov12s-face");
      if (!ensured.success) {
        return {
          ok: false as const,
          error: `ensureDetectorModel: ${ensured.error ?? "unknown"}`,
        };
      }

      const failures: string[] = [];
      for (const p of paths) {
        try {
          const r = await window.desktopApi.detectFacesForMediaItem(p, faceDetection);
          if (!r.success) {
            failures.push(`${p}: success=false`);
          } else if (r.faceCount < 1) {
            failures.push(`${p}: faceCount=${r.faceCount}`);
          }
        } catch (e) {
          failures.push(`${p}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return failures.length === 0
        ? { ok: true as const }
        : { ok: false as const, error: failures.join("; ") };
    }, fullPaths);

    if (!result.ok) {
      throw new Error((result as { error: string }).error);
    }
    expect(result.ok).toBe(true);
  });
});
