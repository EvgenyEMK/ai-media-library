/**
 * Age/gender estimator.
 *
 * Model: onnx-community/age-gender-prediction-ONNX (ViT-base, Apache-2.0).
 *   Input: [1, 3, 224, 224] RGB float32, ImageNet normalization
 *     (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]).
 *   Output: logits tensor with 2 values: [age, gender].
 *     - `age` is a regression output — rounded to int and clamped to [0, 100].
 *     - `gender >= 0.5` → female, else male.
 *     - Confidence is max(gender, 1 - gender).
 */

import * as ort from "onnxruntime-node";
import { cropRgb, resizeRgb, type RawImage } from "./image-utils";
import { getAuxModelFilename, getAuxModelPath, isAuxModelDownloaded } from "./model-manager";
import type { FaceAgeGenderModelId } from "../../src/shared/ipc";

const INPUT_SIZE = 224;
const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];
const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

type SessionState = {
  promise: Promise<ort.InferenceSession> | null;
  error: string | null;
};

const sessions = new Map<FaceAgeGenderModelId, SessionState>();

function stateFor(id: FaceAgeGenderModelId): SessionState {
  let s = sessions.get(id);
  if (!s) {
    s = { promise: null, error: null };
    sessions.set(id, s);
  }
  return s;
}

async function getSession(
  id: FaceAgeGenderModelId,
): Promise<ort.InferenceSession> {
  const state = stateFor(id);
  if (!state.promise) {
    state.promise = ort.InferenceSession.create(
      getAuxModelPath("age-gender", id),
      { executionProviders: ["cpu"] },
    );
  }
  try {
    return await state.promise;
  } catch (err) {
    state.promise = null;
    state.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function isAgeGenderEstimatorReady(id: FaceAgeGenderModelId): boolean {
  return isAuxModelDownloaded("age-gender", id) && stateFor(id).error === null;
}

export function resetAgeGenderEstimator(id: FaceAgeGenderModelId): void {
  const s = stateFor(id);
  s.promise = null;
  s.error = null;
}

export function getAgeGenderEstimatorModelFilename(
  id: FaceAgeGenderModelId,
): string {
  return getAuxModelFilename("age-gender", id);
}

function buildPaddedSquareCrop(
  image: RawImage,
  bbox: [number, number, number, number],
  paddingRatio: number,
): RawImage {
  const [x1, y1, x2, y2] = bbox;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const side = Math.max(x2 - x1, y2 - y1) * (1 + paddingRatio);
  const half = side / 2;

  const sx1 = Math.max(0, Math.floor(cx - half));
  const sy1 = Math.max(0, Math.floor(cy - half));
  const sx2 = Math.min(image.width, Math.ceil(cx + half));
  const sy2 = Math.min(image.height, Math.ceil(cy + half));

  return cropRgb(image, sx1, sy1, sx2, sy2);
}

function toNchwImagenet(image: RawImage): Float32Array {
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

/** Interpret the two raw logits as age + gender per the upstream README. */
export function interpretAgeGenderLogits(logits: ArrayLike<number>): {
  ageYears: number;
  gender: "male" | "female";
  genderConfidence: number;
} {
  if (logits.length < 2) {
    throw new Error(
      `age-gender model returned ${logits.length} values, expected >=2`,
    );
  }
  const ageRaw = logits[0];
  const genderRaw = logits[1];
  const ageYears = Math.min(100, Math.max(0, Math.round(ageRaw)));
  const gender: "male" | "female" = genderRaw >= 0.5 ? "female" : "male";
  const genderConfidence = Math.max(genderRaw, 1 - genderRaw);
  return { ageYears, gender, genderConfidence };
}

export interface EstimateAgeGenderParams {
  image: RawImage;
  bbox: [number, number, number, number];
  model: FaceAgeGenderModelId;
  paddingRatio?: number;
  signal?: AbortSignal;
}

export interface AgeGenderEstimate {
  ageYears: number;
  gender: "male" | "female";
  genderConfidence: number;
  model: FaceAgeGenderModelId;
}

export async function estimateAgeGender(
  params: EstimateAgeGenderParams,
): Promise<AgeGenderEstimate> {
  const { image, bbox, model, signal } = params;
  const paddingRatio = params.paddingRatio ?? 0.25;

  if (signal?.aborted) throw new Error("Age/gender estimation cancelled");

  const crop = buildPaddedSquareCrop(image, bbox, paddingRatio);
  if (crop.width === 0 || crop.height === 0) {
    throw new Error("Face crop is empty for age/gender estimation");
  }

  const resized = resizeRgb(crop, INPUT_SIZE, INPUT_SIZE);
  const tensor = toNchwImagenet(resized);

  const session = await getSession(model);
  if (signal?.aborted) throw new Error("Age/gender estimation cancelled");

  const inputName = session.inputNames[0] ?? "pixel_values";
  const feeds: Record<string, ort.Tensor> = {
    [inputName]: new ort.Tensor("float32", tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  };
  const results = await session.run(feeds);
  if (signal?.aborted) throw new Error("Age/gender estimation cancelled");

  const outputName = session.outputNames[0];
  const logits = results[outputName].data as Float32Array;
  const { ageYears, gender, genderConfidence } = interpretAgeGenderLogits(logits);

  return { ageYears, gender, genderConfidence, model };
}
