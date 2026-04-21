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

  test.describe("auxiliary models", () => {
    const auxCases: Array<{
      kind: "orientation" | "landmarks" | "age-gender";
      modelId: string;
      message: string;
    }> = [
      {
        kind: "orientation",
        modelId: "deep-image-orientation-v1",
        message: "Failed to download orientation model (deep-image-orientation-v1).",
      },
      {
        kind: "landmarks",
        modelId: "pfld-ghostone",
        message: "Failed to download landmarks model (pfld-ghostone).",
      },
      {
        kind: "age-gender",
        modelId: "onnx-age-gender-v1",
        message: "Failed to download age-gender model (onnx-age-gender-v1).",
      },
    ];

    for (const c of auxCases) {
      test(`${c.kind}: surfaces failure banner`, async ({ electronApp, mainWindow }) => {
        test.skip(
          process.env.EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD !== "1",
          "Run this test with EMK_E2E_FAIL_FACE_MODEL_DOWNLOAD=1",
        );

        await openE2ePhotoLibrary(electronApp, mainWindow);

        const result = await mainWindow.evaluate(
          async ({ kind, modelId }) => {
            return window.desktopApi.ensureAuxModel(kind as never, modelId as never);
          },
          { kind: c.kind, modelId: c.modelId },
        );
        expect(result.success).toBe(false);

        await expect(mainWindow.getByText(c.message)).toBeVisible({ timeout: 10_000 });
      });
    }
  });
});
