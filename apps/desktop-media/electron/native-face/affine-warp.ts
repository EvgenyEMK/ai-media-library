import type { RawImage } from "./image-utils";

/**
 * Standard ArcFace 112x112 alignment reference template (from InsightFace).
 * Order: left_eye, right_eye, nose_tip, left_mouth, right_mouth.
 */
export const ARCFACE_REF_LANDMARKS: Array<[number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/**
 * Estimate a 2D similarity transform (rotation + uniform scale + translation)
 * from source points to destination points using least-squares.
 *
 * Returns the 2x3 affine matrix [a, -b, tx, b, a, ty] such that:
 *   dst_x = a * src_x - b * src_y + tx
 *   dst_y = b * src_x + a * src_y + ty
 */
export function estimateSimilarityTransform(
  src: Array<[number, number]>,
  dst: Array<[number, number]>,
): [number, number, number, number, number, number] {
  const n = src.length;

  let srcMeanX = 0, srcMeanY = 0, dstMeanX = 0, dstMeanY = 0;
  for (let i = 0; i < n; i++) {
    srcMeanX += src[i][0];
    srcMeanY += src[i][1];
    dstMeanX += dst[i][0];
    dstMeanY += dst[i][1];
  }
  srcMeanX /= n;
  srcMeanY /= n;
  dstMeanX /= n;
  dstMeanY /= n;

  let sxx = 0, syy = 0, sxy = 0, syx = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - srcMeanX;
    const sy = src[i][1] - srcMeanY;
    const dx = dst[i][0] - dstMeanX;
    const dy = dst[i][1] - dstMeanY;

    sxx += sx * dx;
    syy += sy * dy;
    sxy += sx * dy;
    syx += sy * dx;
    ss += sx * sx + sy * sy;
  }

  if (ss === 0) {
    return [1, 0, dstMeanX - srcMeanX, 0, 1, dstMeanY - srcMeanY];
  }

  const a = (sxx + syy) / ss;
  const b = (sxy - syx) / ss;
  const tx = dstMeanX - a * srcMeanX + b * srcMeanY;
  const ty = dstMeanY - b * srcMeanX - a * srcMeanY;

  return [a, -b, tx, b, a, ty];
}

/**
 * Invert a 2x3 similarity transform matrix.
 */
function invertSimilarityMatrix(
  m: [number, number, number, number, number, number],
): [number, number, number, number, number, number] {
  const [a, mb, tx, b, a2, ty] = m;
  const det = a * a2 - mb * b;
  if (Math.abs(det) < 1e-12) {
    return [1, 0, 0, 0, 1, 0];
  }
  const invDet = 1 / det;
  const ia = a2 * invDet;
  const imb = -mb * invDet;
  const ib = -b * invDet;
  const ia2 = a * invDet;
  const itx = -(ia * tx + imb * ty);
  const ity = -(ib * tx + ia2 * ty);
  return [ia, imb, itx, ib, ia2, ity];
}

/**
 * Apply a 2x3 affine warp to an RGB image with bilinear interpolation
 * and BORDER_REPLICATE behavior.
 */
export function warpAffine(
  src: RawImage,
  matrix: [number, number, number, number, number, number],
  dstW: number,
  dstH: number,
): RawImage {
  const inv = invertSimilarityMatrix(matrix);
  const out = new Uint8Array(dstW * dstH * 3);

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx = inv[0] * dx + inv[1] * dy + inv[2];
      const sy = inv[3] * dx + inv[4] * dy + inv[5];

      const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
      const x1 = Math.max(0, Math.min(src.width - 1, x0 + 1));
      const y1 = Math.max(0, Math.min(src.height - 1, y0 + 1));

      const fx = Math.max(0, Math.min(1, sx - Math.floor(sx)));
      const fy = Math.max(0, Math.min(1, sy - Math.floor(sy)));

      const dstOff = (dy * dstW + dx) * 3;
      for (let c = 0; c < 3; c++) {
        const v00 = src.data[(y0 * src.width + x0) * 3 + c];
        const v01 = src.data[(y0 * src.width + x1) * 3 + c];
        const v10 = src.data[(y1 * src.width + x0) * 3 + c];
        const v11 = src.data[(y1 * src.width + x1) * 3 + c];

        out[dstOff + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) +
          v01 * fx * (1 - fy) +
          v10 * (1 - fx) * fy +
          v11 * fx * fy,
        );
      }
    }
  }

  return { data: out, width: dstW, height: dstH, channels: 3 };
}

/**
 * Align a face using 5-point landmarks to the ArcFace 112x112 template.
 */
export function alignFace(
  image: RawImage,
  landmarks5: Array<[number, number]>,
  outputSize: [number, number] = [112, 112],
): RawImage {
  const refLandmarks = ARCFACE_REF_LANDMARKS.map<[number, number]>(([x, y]) => [
    x * (outputSize[0] / 112),
    y * (outputSize[1] / 112),
  ]);

  const matrix = estimateSimilarityTransform(landmarks5, refLandmarks);
  return warpAffine(image, matrix, outputSize[0], outputSize[1]);
}
