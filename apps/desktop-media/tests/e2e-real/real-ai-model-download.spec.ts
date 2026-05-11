import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "../e2e/fixtures/app-fixture";

type ModelDownloadEvent = {
  type?: string;
  filename?: string | null;
  percent?: number | null;
  message?: string;
  error?: string;
};

const realModelsRuntimeRoot =
  process.env.EMK_E2E_REAL_MODELS_RUNTIME_ROOT?.trim() ||
  path.join(os.homedir(), ".emk-desktop-media-e2e-real-models");
const reuseCachedModels = process.env.EMK_E2E_REAL_MODELS_REUSE_CACHE === "1";

if (!reuseCachedModels) {
  fs.rmSync(realModelsRuntimeRoot, { recursive: true, force: true });
}

const DETECTOR_MODELS = [
  { id: "retinaface", filename: "retinaface_mv2.onnx" },
  { id: "yolov12n-face", filename: "yolov12n-face.onnx" },
  { id: "yolov12s-face", filename: "yolov12s-face.onnx" },
  { id: "yolov12m-face", filename: "yolov12m-face.onnx" },
  { id: "yolov12l-face", filename: "yolov12l-face.onnx" },
] as const;

const AUX_MODELS = [
  { kind: "orientation", id: "deep-image-orientation-v1", filename: "deep-image-orientation.onnx" },
  { kind: "landmarks", id: "pfld-ghostone", filename: "pfld_ghostone.onnx" },
  { kind: "age-gender", id: "onnx-age-gender-v1", filename: "age-gender.onnx" },
] as const;

const CORE_MODEL_FILES = ["w600k_r50.onnx"] as const;

async function collectModelDownloadEvents(mainWindow: Page): Promise<void> {
  await mainWindow.evaluate(() => {
    // @ts-expect-error - test-only capture
    window.__e2eModelDownloadEvents = [];
    // @ts-expect-error - test-only capture
    window.__e2eModelDownloadUnsub = window.desktopApi.onFaceModelDownloadProgress((event) => {
      // @ts-expect-error - test-only capture
      window.__e2eModelDownloadEvents.push(event);
    });
  });
}

async function stopCollectingModelDownloadEvents(mainWindow: Page): Promise<ModelDownloadEvent[]> {
  return mainWindow.evaluate(() => {
    // @ts-expect-error - test-only capture
    window.__e2eModelDownloadUnsub?.();
    // @ts-expect-error - test-only capture
    return window.__e2eModelDownloadEvents ?? [];
  });
}

async function onnxModelsPath(mainWindow: Page): Promise<string> {
  return mainWindow.evaluate(async () => {
    const location = await window.desktopApi.getDatabaseLocation();
    return location.onnxModelsPath;
  });
}

function expectDownloadedModels(onnxDir: string): void {
  for (const filename of [
    ...CORE_MODEL_FILES,
    ...DETECTOR_MODELS.map((model) => model.filename),
    ...AUX_MODELS.map((model) => model.filename),
  ]) {
    const modelPath = path.join(onnxDir, filename);
    expect(fs.existsSync(modelPath), `Expected downloaded model at ${modelPath}`).toBe(true);
    expect(fs.statSync(modelPath).size, `Expected non-empty model at ${modelPath}`).toBeGreaterThan(1024);
  }
}

test.use({
  e2eRuntimeRootPath: realModelsRuntimeRoot,
  e2eSkipStartupAiModelsDownload: false,
});

test.describe("Real AI model downloads", () => {
  test("downloads startup and settings-selected ONNX models with Background operations progress", async ({
    mainWindow,
  }) => {
    await collectModelDownloadEvents(mainWindow);

    try {
      for (const model of DETECTOR_MODELS) {
        const result = await mainWindow.evaluate(async (detectorModel) => {
          return window.desktopApi.ensureDetectorModel(detectorModel);
        }, model.id);
        expect(result.success, result.error ?? `ensureDetectorModel(${model.id}) failed`).toBe(true);
      }

      for (const model of AUX_MODELS) {
        const result = await mainWindow.evaluate(async ({ kind, id }) => {
          return window.desktopApi.ensureAuxModel(kind as never, id as never);
        }, model);
        expect(result.success, result.error ?? `ensureAuxModel(${model.kind}/${model.id}) failed`).toBe(true);
      }

      const events = await stopCollectingModelDownloadEvents(mainWindow);
      if (!reuseCachedModels) {
        expect(events.some((event) => event.type === "started")).toBe(true);
        expect(events.some((event) => event.type === "completed")).toBe(true);
      }
      expect(events.some((event) => event.type === "failed")).toBe(false);

      expectDownloadedModels(await onnxModelsPath(mainWindow));
    } finally {
      await stopCollectingModelDownloadEvents(mainWindow).catch(() => []);
    }
  });
});
