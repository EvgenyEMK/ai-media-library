/**
 * PFLD_GhostOne landmark refiner.
 *
 * Model: PFLD-family ONNX (e.g. AnthonyF333/PFLD_GhostOne or HiSpark
 *   `pfld-sim`). Input: [1, 3, 112, 112] RGB float32, pixels in [0,1].
 *   Output: a float32 tensor shaped [1, 196] (98 landmarks × 2); some exports
 *   also emit intermediate tensors — we pick the [1,196] output by shape.
 *   Landmark coordinates are normalized [0,1] relative to the 112×112 crop.
 *
 * We run the refiner on each detected face crop (a padded square around the
 * detection bounding box) and reduce the 98 WFLW landmarks down to the 5-point
 * (left_eye, right_eye, nose, left_mouth, right_mouth) layout used by ArcFace
 * alignment and the rest of the app.
 *
 * To remain robust against indexing conventions, eye points are reduced by
 * averaging the 8 outline points per eye and then ordering them by x so the
 * first entry is the viewer-left eye. Mouth corners use outer-mouth landmarks
 * at indices 76/82 with the same viewer-x ordering.
 */

import * as ort from "onnxruntime-node";
import { cropRgb, resizeRgb, type RawImage } from "./image-utils";
import { getAuxModelFilename, getAuxModelPath, isAuxModelDownloaded } from "./model-manager";
import type { FaceLandmarkModelId } from "../../src/shared/ipc";
import { createOrtSessionWithFallback } from "./onnx-provider-policy";

const INPUT_SIZE = 112;

type LandmarkSessionState = {
  promise: Promise<ort.InferenceSession> | null;
  error: string | null;
};

const sessions = new Map<FaceLandmarkModelId, LandmarkSessionState>();

function stateFor(id: FaceLandmarkModelId): LandmarkSessionState {
  let s = sessions.get(id);
  if (!s) {
    s = { promise: null, error: null };
    sessions.set(id, s);
  }
  return s;
}

async function getSession(
  id: FaceLandmarkModelId,
): Promise<ort.InferenceSession> {
  const state = stateFor(id);
  if (!state.promise) {
    state.promise = createOrtSessionWithFallback({
      modelPath: getAuxModelPath("landmarks", id),
      sessionName: `landmark-refiner:${id}`,
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

export function isLandmarkRefinerReady(id: FaceLandmarkModelId): boolean {
  return isAuxModelDownloaded("landmarks", id) && stateFor(id).error === null;
}

export function resetLandmarkRefiner(id: FaceLandmarkModelId): void {
  const s = stateFor(id);
  s.promise = null;
  s.error = null;
}

export function getLandmarkRefinerModelFilename(
  id: FaceLandmarkModelId,
): string {
  return getAuxModelFilename("landmarks", id);
}

function buildPaddedSquareCrop(
  image: RawImage,
  bbox: [number, number, number, number],
  paddingRatio: number,
): { crop: RawImage; originX: number; originY: number; cropSize: number } {
  const [x1, y1, x2, y2] = bbox;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const side = Math.max(x2 - x1, y2 - y1) * (1 + paddingRatio);
  const half = side / 2;

  const sx1 = Math.max(0, Math.floor(cx - half));
  const sy1 = Math.max(0, Math.floor(cy - half));
  const sx2 = Math.min(image.width, Math.ceil(cx + half));
  const sy2 = Math.min(image.height, Math.ceil(cy + half));

  const crop = cropRgb(image, sx1, sy1, sx2, sy2);
  return { crop, originX: sx1, originY: sy1, cropSize: Math.max(crop.width, crop.height) };
}

function toNchw01(image: RawImage): Float32Array {
  const { width, height, data } = image;
  const pixels = width * height;
  const tensor = new Float32Array(3 * pixels);
  const rPlane = 0;
  const gPlane = pixels;
  const bPlane = pixels * 2;
  for (let i = 0; i < pixels; i++) {
    const off = i * 3;
    tensor[rPlane + i] = data[off] / 255;
    tensor[gPlane + i] = data[off + 1] / 255;
    tensor[bPlane + i] = data[off + 2] / 255;
  }
  return tensor;
}

function avgPoint(
  flat: Float32Array | number[],
  startIdx: number,
  endIdx: number,
): [number, number] {
  let sx = 0;
  let sy = 0;
  const n = endIdx - startIdx + 1;
  for (let i = startIdx; i <= endIdx; i++) {
    sx += flat[i * 2];
    sy += flat[i * 2 + 1];
  }
  return [sx / n, sy / n];
}

/**
 * Reduce 98 WFLW landmarks to the 5-point ArcFace order:
 * [viewer-left eye, viewer-right eye, nose tip, viewer-left mouth, viewer-right mouth]
 */
export function reduce98To5(
  flat: Float32Array | number[],
): Array<[number, number]> {
  if (flat.length < 98 * 2) {
    throw new Error(
      `Expected 196 values for 98 landmarks, got ${flat.length}`,
    );
  }
  // WFLW groups: 60-67 = one eye, 68-75 = other eye (convention varies).
  const eyeA = avgPoint(flat, 60, 67);
  const eyeB = avgPoint(flat, 68, 75);
  const viewerLeftEye = eyeA[0] <= eyeB[0] ? eyeA : eyeB;
  const viewerRightEye = eyeA[0] <= eyeB[0] ? eyeB : eyeA;

  const nose: [number, number] = [flat[54 * 2], flat[54 * 2 + 1]];

  const m76: [number, number] = [flat[76 * 2], flat[76 * 2 + 1]];
  const m82: [number, number] = [flat[82 * 2], flat[82 * 2 + 1]];
  const viewerLeftMouth = m76[0] <= m82[0] ? m76 : m82;
  const viewerRightMouth = m76[0] <= m82[0] ? m82 : m76;

  return [viewerLeftEye, viewerRightEye, nose, viewerLeftMouth, viewerRightMouth];
}

export interface RefineLandmarksParams {
  image: RawImage;
  bbox: [number, number, number, number];
  model: FaceLandmarkModelId;
  paddingRatio?: number;
  signal?: AbortSignal;
}

/**
 * Refine landmarks for a single face crop. Returns 5 (x, y) points in the
 * coordinate space of the original full-size image (pixel space).
 */
export async function refineLandmarks(
  params: RefineLandmarksParams,
): Promise<Array<[number, number]>> {
  const { image, bbox, model, signal } = params;
  const paddingRatio = params.paddingRatio ?? 0.25;

  if (signal?.aborted) throw new Error("Landmark refinement cancelled");

  const { crop, originX, originY, cropSize } = buildPaddedSquareCrop(
    image,
    bbox,
    paddingRatio,
  );
  if (crop.width === 0 || crop.height === 0) {
    throw new Error("Face crop is empty for landmark refinement");
  }

  const resized = resizeRgb(crop, INPUT_SIZE, INPUT_SIZE);
  const tensor = toNchw01(resized);

  const session = await getSession(model);
  if (signal?.aborted) throw new Error("Landmark refinement cancelled");

  const inputName = session.inputNames[0] ?? "input";
  const feeds: Record<string, ort.Tensor> = {
    [inputName]: new ort.Tensor("float32", tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  };
  const results = await session.run(feeds);
  if (signal?.aborted) throw new Error("Landmark refinement cancelled");

  let raw: Float32Array | null = null;
  for (const name of session.outputNames) {
    const tensor = results[name];
    const dims = tensor.dims;
    if (
      tensor.type === "float32" &&
      dims.length === 2 &&
      dims[0] === 1 &&
      dims[1] === 98 * 2
    ) {
      raw = tensor.data as Float32Array;
      break;
    }
  }
  if (!raw) {
    throw new Error(
      "Landmark model has no float32 output shaped [1, 196] (98×2 landmarks)",
    );
  }

  const landmarks5Normalized = reduce98To5(raw);

  // Map from 112×112 normalized coords → original image pixel coords via the
  // actual crop dimensions (which may be rectangular at the image border).
  return landmarks5Normalized.map(([nx, ny]) => {
    const x = originX + nx * crop.width;
    const y = originY + ny * crop.height;
    return [x, y] as [number, number];
  });
}
