/**
 * Image orientation classifier.
 *
 * Model: DuarteBarbosa/deep-image-orientation-detection (EfficientNetV2-S, MIT).
 * Input: NCHW float32 [1, 3, 384, 384], RGB pixels normalized with ImageNet
 *   mean/std (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]).
 * Preprocess: resize to 416x416, center-crop to 384x384 (matches the reference
 *   `predict_onnx.py`).
 * Output: 4 logits. Class index maps to the clockwise correction needed to
 *   bring the image upright:
 *     0 -> 0°, 1 -> 90°, 2 -> 180°, 3 -> 270°.
 */

import * as ort from "onnxruntime-node";
import { getAuxModelFilename, getAuxModelPath, isAuxModelDownloaded } from "./model-manager";
import { loadImageRgb, resizeRgb, type RawImage } from "./image-utils";
import type { ImageOrientationModelId } from "../../src/shared/ipc";
import { createOrtSessionWithFallback } from "./onnx-provider-policy";

const RESIZE_TARGET = 416;
const CROP_TARGET = 384;
const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];
const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

type OrientationSessionState = {
  promise: Promise<ort.InferenceSession> | null;
  error: string | null;
};

const sessions = new Map<ImageOrientationModelId, OrientationSessionState>();

function stateFor(id: ImageOrientationModelId): OrientationSessionState {
  let s = sessions.get(id);
  if (!s) {
    s = { promise: null, error: null };
    sessions.set(id, s);
  }
  return s;
}

async function getSession(
  id: ImageOrientationModelId,
): Promise<ort.InferenceSession> {
  const state = stateFor(id);
  if (!state.promise) {
    state.promise = createOrtSessionWithFallback({
      modelPath: getAuxModelPath("orientation", id),
      sessionName: `orientation-classifier:${id}`,
    }).then((result) => result.session);
  }
  try {
    return await state.promise;
  } catch (err) {
    state.promise = null;
    state.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function isOrientationClassifierReady(id: ImageOrientationModelId): boolean {
  return isAuxModelDownloaded("orientation", id) && stateFor(id).error === null;
}

export function resetOrientationClassifier(id: ImageOrientationModelId): void {
  const s = stateFor(id);
  s.promise = null;
  s.error = null;
}

export function getOrientationClassifierModelFilename(
  id: ImageOrientationModelId,
): string {
  return getAuxModelFilename("orientation", id);
}

function centerCrop(image: RawImage, target: number): RawImage {
  const { width, height, data } = image;
  if (width === target && height === target) {
    return { data: new Uint8Array(data), width, height, channels: 3 };
  }
  const x0 = Math.max(0, Math.floor((width - target) / 2));
  const y0 = Math.max(0, Math.floor((height - target) / 2));
  const w = Math.min(target, width - x0);
  const h = Math.min(target, height - y0);

  const out = new Uint8Array(target * target * 3);
  for (let row = 0; row < h; row++) {
    const srcOff = ((y0 + row) * width + x0) * 3;
    const dstOff = row * target * 3;
    out.set(data.subarray(srcOff, srcOff + w * 3), dstOff);
  }
  return { data: out, width: target, height: target, channels: 3 };
}

function toNchwFloat32(image: RawImage): Float32Array {
  const pixels = image.width * image.height;
  const tensor = new Float32Array(3 * pixels);
  const rPlane = 0;
  const gPlane = pixels;
  const bPlane = pixels * 2;
  for (let i = 0; i < pixels; i++) {
    const off = i * 3;
    tensor[rPlane + i] =
      (image.data[off] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    tensor[gPlane + i] =
      (image.data[off + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    tensor[bPlane + i] =
      (image.data[off + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }
  return tensor;
}

function softmax(logits: Float32Array | number[]): number[] {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / (sum || 1));
}

const CLASS_TO_CORRECTION: [0, 90, 180, 270] = [0, 90, 180, 270];

export interface OrientationPrediction {
  correctionClockwise: 0 | 90 | 180 | 270;
  confidence: number;
  probabilities: [number, number, number, number];
  model: ImageOrientationModelId;
}

export interface OrientationPredictParams {
  imagePath?: string;
  image?: RawImage;
  model: ImageOrientationModelId;
  signal?: AbortSignal;
}

export async function predictOrientation(
  params: OrientationPredictParams,
): Promise<OrientationPrediction> {
  const { imagePath, image, model, signal } = params;

  if (!imagePath && !image) {
    throw new Error("predictOrientation requires `imagePath` or `image`");
  }
  if (signal?.aborted) throw new Error("Orientation detection cancelled");

  const session = await getSession(model);
  const rgb = image ?? (await loadImageRgb(imagePath as string));
  if (signal?.aborted) throw new Error("Orientation detection cancelled");

  const resized = resizeRgb(rgb, RESIZE_TARGET, RESIZE_TARGET);
  const cropped = centerCrop(resized, CROP_TARGET);
  const tensor = toNchwFloat32(cropped);

  const inputName = session.inputNames[0] ?? "input";
  const feeds: Record<string, ort.Tensor> = {
    [inputName]: new ort.Tensor("float32", tensor, [1, 3, CROP_TARGET, CROP_TARGET]),
  };
  const results = await session.run(feeds);
  if (signal?.aborted) throw new Error("Orientation detection cancelled");

  const outputName = session.outputNames[0];
  const output = results[outputName];
  const logits = output.data as Float32Array;
  if (logits.length < 4) {
    throw new Error(
      `Orientation classifier produced unexpected output length ${logits.length}`,
    );
  }

  const probs = softmax(Array.from(logits.slice(0, 4)));
  let bestIdx = 0;
  for (let i = 1; i < 4; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  return {
    correctionClockwise: CLASS_TO_CORRECTION[bestIdx],
    confidence: probs[bestIdx],
    probabilities: [probs[0], probs[1], probs[2], probs[3]],
    model,
  };
}
