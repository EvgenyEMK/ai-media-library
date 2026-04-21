/**
 * Decode YOLO-face ONNX outputs. The akanametov/yolo-face releases ship at least two layouts:
 *
 * 1) **Pose / channel-major** `[1, 20, N]` — 20 channels × N anchors (cx, cy, w, h, conf, 15 keypoint values).
 * 2) **End-to-end NMS** `[1, N, 6]` or `[1, 6, N]` — each detection is `x1, y1, x2, y2, score, class_id`
 *    in letterboxed input space (typically 640×640). Padding rows often have score 0.
 */

import { nms } from "./nms";

const LETTERBOX_SIZE = 640;

export interface LetterboxMapping {
  scale: number;
  padX: number;
  padY: number;
  imgW: number;
  imgH: number;
}

/** RetinaFace-order 5-point landmarks from a face box when the model has no keypoints. */
export function approximateLandmarksFromXyxy(
  bbox: [number, number, number, number],
): Array<[number, number]> {
  const [x1, y1, x2, y2] = bbox;
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  return [
    [x1 + 0.35 * w, y1 + 0.38 * h],
    [x1 + 0.65 * w, y1 + 0.38 * h],
    [x1 + 0.5 * w, y1 + 0.55 * h],
    [x1 + 0.38 * w, y1 + 0.72 * h],
    [x1 + 0.62 * w, y1 + 0.72 * h],
  ];
}

function letterboxToOriginal(
  lbX1: number,
  lbY1: number,
  lbX2: number,
  lbY2: number,
  map: LetterboxMapping,
): [number, number, number, number] {
  const { scale, padX, padY, imgW, imgH } = map;
  const x1 = (lbX1 - padX) / scale;
  const y1 = (lbY1 - padY) / scale;
  const x2 = (lbX2 - padX) / scale;
  const y2 = (lbY2 - padY) / scale;
  return [
    Math.max(0, Math.min(imgW, x1)),
    Math.max(0, Math.min(imgH, y1)),
    Math.max(0, Math.min(imgW, x2)),
    Math.max(0, Math.min(imgH, y2)),
  ];
}

/**
 * If coords look normalized to [0,1], scale to letterbox pixels.
 */
function normalizeLetterboxBox(
  a: number,
  b: number,
  c: number,
  d: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const maxV = Math.max(a, b, c, d);
  if (maxV <= 1.5 && c > a && d > b) {
    return {
      x1: a * LETTERBOX_SIZE,
      y1: b * LETTERBOX_SIZE,
      x2: c * LETTERBOX_SIZE,
      y2: d * LETTERBOX_SIZE,
    };
  }
  return { x1: a, y1: b, x2: c, y2: d };
}

export interface DecodedYoloCandidates {
  pixelBoxes: Float32Array;
  scores: Float32Array;
  pixelLandmarks: Float32Array;
}

/**
 * Channel-major pose layout `[1, 20, N]` (see yolo-face-detector header comment).
 */
export function decodeChannelMajorPose20(
  outData: Float32Array,
  numAnchors: number,
  confThreshold: number,
  map: LetterboxMapping,
): DecodedYoloCandidates {
  const candidateIndices: number[] = [];
  for (let i = 0; i < numAnchors; i++) {
    const conf = outData[4 * numAnchors + i];
    if (conf >= confThreshold) candidateIndices.push(i);
  }
  candidateIndices.sort(
    (a, b) => outData[4 * numAnchors + b] - outData[4 * numAnchors + a],
  );
  const preNms = candidateIndices.slice(0, 3000);

  const n = preNms.length;
  const pixelBoxes = new Float32Array(n * 4);
  const scores = new Float32Array(n);
  const pixelLandmarks = new Float32Array(n * 10);
  const { scale, padX, padY, imgW, imgH } = map;

  for (let k = 0; k < n; k++) {
    const i = preNms[k];
    const cx = outData[0 * numAnchors + i];
    const cy = outData[1 * numAnchors + i];
    const w = outData[2 * numAnchors + i];
    const h = outData[3 * numAnchors + i];
    const conf = outData[4 * numAnchors + i];

    const lbX1 = cx - w / 2;
    const lbY1 = cy - h / 2;
    const lbX2 = cx + w / 2;
    const lbY2 = cy + h / 2;

    const [x1, y1, x2, y2] = letterboxToOriginal(lbX1, lbY1, lbX2, lbY2, map);
    pixelBoxes[k * 4] = x1;
    pixelBoxes[k * 4 + 1] = y1;
    pixelBoxes[k * 4 + 2] = x2;
    pixelBoxes[k * 4 + 3] = y2;
    scores[k] = conf;

    for (let p = 0; p < 5; p++) {
      const kpx = outData[(5 + p * 3) * numAnchors + i];
      const kpy = outData[(5 + p * 3 + 1) * numAnchors + i];
      pixelLandmarks[k * 10 + p * 2] = (kpx - padX) / scale;
      pixelLandmarks[k * 10 + p * 2 + 1] = (kpy - padY) / scale;
    }
  }

  return { pixelBoxes, scores, pixelLandmarks };
}

/**
 * End-to-end `[1, N, 6]` or `[1, 6, N]` detections (x1,y1,x2,y2,conf,class).
 */
export function decodeEnd2EndSix(
  outData: Float32Array,
  dims: readonly number[],
  confThreshold: number,
  map: LetterboxMapping,
): DecodedYoloCandidates {
  let rows: Array<{ x1: number; y1: number; x2: number; y2: number; conf: number; cls: number }> =
    [];

  if (dims.length !== 3) {
    return { pixelBoxes: new Float32Array(0), scores: new Float32Array(0), pixelLandmarks: new Float32Array(0) };
  }

  const d1 = dims[1]!;
  const d2 = dims[2]!;

  if (d2 === 6) {
    // [1, N, 6] row-major
    for (let i = 0; i < d1; i++) {
      const o = i * 6;
      const a = outData[o];
      const b = outData[o + 1];
      const c = outData[o + 2];
      const d = outData[o + 3];
      const conf = outData[o + 4];
      const cls = outData[o + 5];
      const box = normalizeLetterboxBox(a, b, c, d);
      rows.push({ ...box, conf, cls });
    }
  } else if (d1 === 6) {
    // [1, 6, N]
    const n = d2;
    for (let i = 0; i < n; i++) {
      const a = outData[0 * n + i];
      const b = outData[1 * n + i];
      const c = outData[2 * n + i];
      const d = outData[3 * n + i];
      const conf = outData[4 * n + i];
      const cls = outData[5 * n + i];
      const box = normalizeLetterboxBox(a, b, c, d);
      rows.push({ ...box, conf, cls });
    }
  } else {
    return { pixelBoxes: new Float32Array(0), scores: new Float32Array(0), pixelLandmarks: new Float32Array(0) };
  }

  rows = rows.filter((r) => {
    if (!Number.isFinite(r.conf) || r.conf < confThreshold) return false;
    if (r.x2 <= r.x1 || r.y2 <= r.y1) return false;
    return true;
  });

  rows.sort((a, b) => b.conf - a.conf);
  const preNms = rows.slice(0, 3000);

  const n = preNms.length;
  const pixelBoxes = new Float32Array(n * 4);
  const scores = new Float32Array(n);
  const pixelLandmarks = new Float32Array(n * 10);

  for (let k = 0; k < n; k++) {
    const r = preNms[k]!;
    const [x1, y1, x2, y2] = letterboxToOriginal(r.x1, r.y1, r.x2, r.y2, map);
    pixelBoxes[k * 4] = x1;
    pixelBoxes[k * 4 + 1] = y1;
    pixelBoxes[k * 4 + 2] = x2;
    pixelBoxes[k * 4 + 3] = y2;
    scores[k] = r.conf;

    const lm = approximateLandmarksFromXyxy([x1, y1, x2, y2]);
    for (let p = 0; p < 5; p++) {
      pixelLandmarks[k * 10 + p * 2] = lm[p]![0];
      pixelLandmarks[k * 10 + p * 2 + 1] = lm[p]![1];
    }
  }

  return { pixelBoxes, scores, pixelLandmarks };
}

export function runNmsOnDecoded(
  decoded: DecodedYoloCandidates,
  nmsThreshold: number,
  maxPost: number,
): number[] {
  const { pixelBoxes, scores } = decoded;
  const n = scores.length;
  if (n === 0) return [];
  return nms(pixelBoxes, scores, nmsThreshold).slice(0, maxPost);
}
