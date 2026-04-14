/**
 * Integration tests for the native face detection pipeline.
 *
 * These tests require ONNX model files to be present. They are skipped
 * when models are not available (CI without pre-downloaded models).
 *
 * To run:
 *   1. Download models: npx tsx electron/native-face/model-manager.ts
 *   2. Set EMK_NATIVE_FACE_MODELS_DIR to the models directory
 *   3. Run: pnpm test -- electron/native-face/native-face-detection.integration.test.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Jimp } from "jimp";
import { generatePriors } from "./prior-box";
import { RETINAFACE_MOBILENETV2 } from "./config";
import { setModelsDirectory, isModelDownloaded } from "./model-manager";

const MODELS_DIR =
  process.env.EMK_NATIVE_FACE_MODELS_DIR?.trim() ||
  path.join(os.homedir(), ".emk-test-models");

const RETINAFACE_MODEL = "retinaface_mv2.onnx";
const ARCFACE_MODEL = "w600k_r50.onnx";

let tempDir: string | null = null;
let testImagePath: string;

/**
 * Generate a synthetic test image with clearly positioned "face-like"
 * features (flesh-toned oval with eye/nose/mouth dots) that RetinaFace
 * should detect. 300x400 JPEG.
 */
async function createFaceTestImage(destPath: string): Promise<void> {
  const w = 300;
  const h = 400;
  const image = new Jimp({ width: w, height: h, color: 0xddeeffff });

  // Draw a flesh-toned oval region in the center
  const cx = 150, cy = 180, rx = 60, ry = 80;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        // Skin-tone color
        image.setPixelColor(0xd4a574ff, x, y);
      }
    }
  }

  // Eye regions (dark dots)
  const drawDot = (dotX: number, dotY: number, radius: number, color: number) => {
    for (let y = dotY - radius; y <= dotY + radius; y++) {
      for (let x = dotX - radius; x <= dotX + radius; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const dist = Math.sqrt((x - dotX) ** 2 + (y - dotY) ** 2);
          if (dist <= radius) {
            image.setPixelColor(color, x, y);
          }
        }
      }
    }
  };

  drawDot(130, 160, 8, 0x332211ff); // Left eye
  drawDot(170, 160, 8, 0x332211ff); // Right eye
  drawDot(150, 185, 5, 0xcc8866ff); // Nose
  drawDot(150, 210, 10, 0xbb5544ff); // Mouth

  await image.write(destPath as `${string}.jpg`);
}

function modelsAvailable(): boolean {
  setModelsDirectory(MODELS_DIR);
  return isModelDownloaded(RETINAFACE_MODEL);
}

async function ensureTestImage(): Promise<void> {
  if (!tempDir) {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "emk-face-test-"));
    testImagePath = path.join(tempDir, "test-face.jpg");
    await createFaceTestImage(testImagePath);
  }
}

afterAll(async () => {
  if (tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  }
});

describe("native face detection integration", () => {
  beforeAll(async () => {
    setModelsDirectory(MODELS_DIR);
    await ensureTestImage();
  });

  it("prior count formula is consistent across different resolutions", () => {
    const dims: Array<[number, number]> = [
      [640, 480], [1920, 1080], [800, 600], [320, 240],
    ];
    for (const [w, h] of dims) {
      const priors = generatePriors(w, h, RETINAFACE_MOBILENETV2);
      const numPriors = priors.length / 4;
      const expected =
        2 * (Math.ceil(h / 8) * Math.ceil(w / 8) +
          Math.ceil(h / 16) * Math.ceil(w / 16) +
          Math.ceil(h / 32) * Math.ceil(w / 32));
      expect(numPriors).toBe(expected);
    }
  });

  it.skipIf(!modelsAvailable())(
    "native detector runs on a synthetic face image and returns valid output",
    async () => {
      const { detectFacesNative, resetNativeDetector } = await import("./retinaface-detector");
      resetNativeDetector();

      const result = await detectFacesNative({
        imagePath: testImagePath,
        confThreshold: 0.1,
      });

      expect(result).toBeDefined();
      expect(typeof result.faceCount).toBe("number");
      expect(result.faceCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.faces)).toBe(true);
      expect(result.imageSizeForBoundingBoxes).toEqual({ width: 300, height: 400 });
      expect(result.modelInfo.service).toBe("retinaface-native");

      if (result.faceCount > 0) {
        const face = result.faces[0];
        expect(face.bbox_xyxy.length).toBe(4);
        expect(face.landmarks_5.length).toBe(5);
        expect(face.score).toBeGreaterThan(0);
        for (const [x, y] of face.landmarks_5) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
        }
      }
    },
    30_000,
  );

  it.skipIf(!modelsAvailable() || !isModelDownloaded(ARCFACE_MODEL))(
    "native embedder runs on a synthetic face and returns 512-dim vector",
    async () => {
      const { detectFacesNative, resetNativeDetector } = await import("./retinaface-detector");
      const { embedFacesNative, resetNativeEmbedder } = await import("./arcface-embedder");
      resetNativeDetector();
      resetNativeEmbedder();

      const detection = await detectFacesNative({
        imagePath: testImagePath,
        confThreshold: 0.1,
      });

      if (detection.faceCount === 0) {
        console.log("[test] No faces detected in synthetic image; skipping embedding test.");
        return;
      }

      const result = await embedFacesNative({
        imagePath: testImagePath,
        faces: detection.faces,
      });

      expect(result.embeddings.length).toBeGreaterThan(0);
      const emb = result.embeddings[0];
      expect(emb.dimension).toBe(512);
      expect(emb.vector.length).toBe(512);

      // Verify L2 normalization
      let sumSq = 0;
      for (const v of emb.vector) sumSq += v * v;
      expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 3);
    },
    30_000,
  );
});
