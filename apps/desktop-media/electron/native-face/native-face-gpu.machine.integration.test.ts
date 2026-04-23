import path from "node:path";
import os from "node:os";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ensureActiveModels,
  ensureAuxModel,
  setModelsDirectory,
} from "./model-manager";
import { predictOrientation, resetOrientationClassifier } from "./orientation-classifier";
import { detectFacesInPhoto } from "../face-detection";
import { DEFAULT_FACE_DETECTION_SETTINGS } from "../../src/shared/ipc";
import { resetYoloDetector } from "./yolo-face-detector";
import { resetLandmarkRefiner } from "./landmark-refiner";
import { embedFacesNative, resetNativeEmbedder } from "./arcface-embedder";

const MODELS_DIR =
  process.env.EMK_NATIVE_FACE_MODELS_DIR?.trim() ||
  path.join(os.homedir(), ".emk-test-models");

const TEST_IMAGE_PATH = path.resolve(
  __dirname,
  "../../test-assets-local/e2e-photos/face-detect-sample-01.jpg",
);

const ORIENTATION_MODEL = "deep-image-orientation-v1";
const LANDMARK_MODEL = "pfld-ghostone";
const DETECTOR_MODEL = "yolov12s-face";
const GPU_PROVIDERS = new Set(["cuda", "dml"]);

beforeAll(async () => {
  setModelsDirectory(MODELS_DIR);
  await ensureActiveModels(DETECTOR_MODEL);
  await ensureAuxModel("orientation", ORIENTATION_MODEL);
  await ensureAuxModel("landmarks", LANDMARK_MODEL);
});

describe.skipIf(process.platform !== "win32")(
  "native face GPU pipeline (machine-specific)",
  () => {
    it(
      "uses GPU providers for orientation, detection, landmark, and embedding models",
      async () => {
        resetOrientationClassifier(ORIENTATION_MODEL);
        resetYoloDetector(DETECTOR_MODEL);
        resetLandmarkRefiner(LANDMARK_MODEL);
        resetNativeEmbedder();

        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args: unknown[]) => {
          const line = args.map((x) => String(x)).join(" ");
          logs.push(line);
          originalLog(...args);
        };

        try {
          await predictOrientation({
            imagePath: TEST_IMAGE_PATH,
            model: ORIENTATION_MODEL,
          });

          const detection = await detectFacesInPhoto({
            imagePath: TEST_IMAGE_PATH,
            settings: {
              ...DEFAULT_FACE_DETECTION_SETTINGS,
              detectorModel: DETECTOR_MODEL,
              faceLandmarkRefinement: {
                enabled: true,
                model: LANDMARK_MODEL,
              },
              // Keep this machine test focused on the 4 core models listed.
              faceAgeGenderDetection: {
                enabled: false,
                model: "onnx-age-gender-v1",
              },
            },
          });

          expect(detection.faceCount).toBeGreaterThan(0);
          expect(detection.faces.some((f) => f.landmarks_5.length === 5)).toBe(true);

          await embedFacesNative({
            imagePath: TEST_IMAGE_PATH,
            faces: detection.faces.slice(0, 1),
          });
        } finally {
          console.log = originalLog;
        }

        const requiredSessionNames = [
          `orientation-classifier:${ORIENTATION_MODEL}`,
          `yolo-face-detector:${DETECTOR_MODEL}`,
          `landmark-refiner:${LANDMARK_MODEL}`,
          "arcface-embedder",
        ];

        for (const sessionName of requiredSessionNames) {
          const sessionLog = logs.find(
            (line) =>
              line.includes("[emk-face][onnx] session-ready") &&
              line.includes(`name=${sessionName}`),
          );
          expect(
            sessionLog,
            `Missing ONNX session-ready log for ${sessionName}`,
          ).toBeTruthy();

          const providerMatch = sessionLog?.match(/provider=([a-z0-9_-]+)/);
          const provider = providerMatch?.[1] ?? "unknown";
          expect(
            GPU_PROVIDERS.has(provider),
            `Expected GPU provider for ${sessionName}, got '${provider}'`,
          ).toBe(true);
        }
      },
      180_000,
    );
  },
);
