import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../src/shared/ipc";
import { runWrongImageRotationPrecheck } from "./orientation-preprocess";

const mocks = vi.hoisted(() => ({
  getOrientationDetectionStateByPath: vi.fn(),
  upsertOrientationDetectionFailure: vi.fn(),
  upsertOrientationDetectionResult: vi.fn(),
  ensureAuxModel: vi.fn(),
  isOrientationClassifierReady: vi.fn(),
  predictOrientation: vi.fn(),
  checkExistingFaceLandmarksForRotation: vi.fn(),
}));

const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, clientId: "test-client" };

vi.mock("./db/media-analysis", () => ({
  getOrientationDetectionStateByPath: (...args: unknown[]) => mocks.getOrientationDetectionStateByPath(...args),
  upsertOrientationDetectionFailure: (...args: unknown[]) => mocks.upsertOrientationDetectionFailure(...args),
  upsertOrientationDetectionResult: (...args: unknown[]) => mocks.upsertOrientationDetectionResult(...args),
}));

vi.mock("./native-face", () => ({
  ensureAuxModel: (...args: unknown[]) => mocks.ensureAuxModel(...args),
}));

vi.mock("./native-face/orientation-classifier", () => ({
  isOrientationClassifierReady: (...args: unknown[]) => mocks.isOrientationClassifierReady(...args),
  predictOrientation: (...args: unknown[]) => mocks.predictOrientation(...args),
}));

vi.mock("./face-rotation-check", () => ({
  checkExistingFaceLandmarksForRotation: (...args: unknown[]) => mocks.checkExistingFaceLandmarksForRotation(...args),
}));

describe("runWrongImageRotationPrecheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrientationDetectionStateByPath.mockReturnValue(null);
    mocks.ensureAuxModel.mockResolvedValue(undefined);
    mocks.isOrientationClassifierReady.mockReturnValue(false);
    mocks.checkExistingFaceLandmarksForRotation.mockReturnValue(null);
  });

  it("persists a failure when classifier and landmark fallback cannot determine rotation", async () => {
    const result = await runWrongImageRotationPrecheck({
      imagePath: "C:\\photos\\image.jpg",
      settings,
      force: true,
    });

    expect(result).toBe("failed");
    expect(mocks.upsertOrientationDetectionFailure).toHaveBeenCalledWith(
      "C:\\photos\\image.jpg",
      "Orientation classifier and face-landmark fallback could not determine rotation.",
    );
    expect(mocks.upsertOrientationDetectionResult).not.toHaveBeenCalled();
  });

  it("persists a failure when fallback is disabled after classifier failure", async () => {
    const result = await runWrongImageRotationPrecheck({
      imagePath: "C:\\photos\\image.jpg",
      settings: {
        ...settings,
        wrongImageRotationDetection: {
          ...settings.wrongImageRotationDetection,
          useFaceLandmarkFeaturesFallback: false,
        },
      },
      force: true,
    });

    expect(result).toBe("failed");
    expect(mocks.upsertOrientationDetectionFailure).toHaveBeenCalledWith(
      "C:\\photos\\image.jpg",
      "Orientation classifier failed and face-landmark fallback is disabled.",
    );
  });
});
