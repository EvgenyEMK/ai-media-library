/**
 * Integration test using a downloaded real face image.
 * Downloads a small CC0 test image from a public URL on first run.
 *
 * Run: EMK_NATIVE_FACE_MODELS_DIR=~/.emk-test-models pnpm test -- native-face-real-image
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setModelsDirectory, isModelDownloaded } from "./model-manager";

const MODELS_DIR =
  process.env.EMK_NATIVE_FACE_MODELS_DIR?.trim() ||
  path.join(os.homedir(), ".emk-test-models");

const RETINAFACE_MODEL = "retinaface_mv2.onnx";
const ARCFACE_MODEL = "w600k_r50.onnx";

const FACE_IMAGE_URL =
  "https://thispersondoesnotexist.com";

let testDir: string | null = null;
let faceImagePath: string;

function modelsAvailable(): boolean {
  setModelsDirectory(MODELS_DIR);
  return isModelDownloaded(RETINAFACE_MODEL);
}

async function downloadTestFaceImage(destPath: string): Promise<boolean> {
  try {
    const resp = await fetch(FACE_IMAGE_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok || !resp.body) return false;
    const arrayBuf = await resp.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuf));
    return true;
  } catch (err) {
    console.warn("[test] Could not download test face image:", err);
    return false;
  }
}

afterAll(async () => {
  if (testDir) {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  }
});

describe("native face detection on real photograph", () => {
  let imageReady = false;

  beforeAll(async () => {
    setModelsDirectory(MODELS_DIR);
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "emk-face-real-"));
    faceImagePath = path.join(testDir, "face.jpg");
    imageReady = await downloadTestFaceImage(faceImagePath);
  });

  it.skipIf(!modelsAvailable())(
    "detects at least one face in a real photograph",
    async () => {
      if (!imageReady) {
        console.log("[test] Face image download failed; skipping.");
        return;
      }

      const { detectFacesNative, resetNativeDetector } = await import("./retinaface-detector");
      resetNativeDetector();

      const result = await detectFacesNative({
        imagePath: faceImagePath,
        confThreshold: 0.5,
      });

      console.log(
        `[test] Real image: detected ${result.faceCount} face(s), ` +
        `image ${result.imageSizeForBoundingBoxes?.width}x${result.imageSizeForBoundingBoxes?.height}`,
      );

      expect(result.faceCount).toBeGreaterThanOrEqual(1);

      const face = result.faces[0];
      expect(face.score).toBeGreaterThan(0.5);
      expect(face.bbox_xyxy[2]).toBeGreaterThan(face.bbox_xyxy[0]);
      expect(face.bbox_xyxy[3]).toBeGreaterThan(face.bbox_xyxy[1]);
      expect(face.landmarks_5.length).toBe(5);
    },
    60_000,
  );

  it.skipIf(!modelsAvailable() || !isModelDownloaded(ARCFACE_MODEL))(
    "generates valid embeddings for faces in real photograph",
    async () => {
      if (!imageReady) {
        console.log("[test] Face image download failed; skipping.");
        return;
      }

      const { detectFacesNative, resetNativeDetector } = await import("./retinaface-detector");
      const { embedFacesNative, resetNativeEmbedder } = await import("./arcface-embedder");
      resetNativeDetector();
      resetNativeEmbedder();

      const detection = await detectFacesNative({
        imagePath: faceImagePath,
        confThreshold: 0.5,
      });

      if (detection.faceCount === 0) {
        console.log("[test] No faces detected; skipping embedding test.");
        return;
      }

      const result = await embedFacesNative({
        imagePath: faceImagePath,
        faces: detection.faces,
      });

      expect(result.embeddings.length).toBe(detection.faceCount);

      for (const emb of result.embeddings) {
        expect(emb.dimension).toBe(512);
        expect(emb.vector.length).toBe(512);

        let sumSq = 0;
        for (const v of emb.vector) sumSq += v * v;
        expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 3);
      }
    },
    60_000,
  );

});
