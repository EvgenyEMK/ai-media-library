import type { RetinaFaceConfig } from "./config";

/**
 * Generate normalized (cx, cy, w, h) prior boxes for the given image
 * dimensions and model config. Matches the Python PriorBox implementation
 * from yakhyo/retinaface-pytorch.
 */
export function generatePriors(
  imageWidth: number,
  imageHeight: number,
  config: RetinaFaceConfig,
): Float32Array {
  const { minSizes, steps, clipPriors } = config;

  let totalPriors = 0;
  for (let k = 0; k < steps.length; k++) {
    const fmH = Math.ceil(imageHeight / steps[k]);
    const fmW = Math.ceil(imageWidth / steps[k]);
    totalPriors += fmH * fmW * minSizes[k].length;
  }

  const priors = new Float32Array(totalPriors * 4);
  let offset = 0;

  for (let k = 0; k < steps.length; k++) {
    const step = steps[k];
    const fmH = Math.ceil(imageHeight / step);
    const fmW = Math.ceil(imageWidth / step);

    for (let i = 0; i < fmH; i++) {
      for (let j = 0; j < fmW; j++) {
        for (const minSize of minSizes[k]) {
          const cx = (j + 0.5) * step / imageWidth;
          const cy = (i + 0.5) * step / imageHeight;
          const sKx = minSize / imageWidth;
          const sKy = minSize / imageHeight;

          priors[offset] = cx;
          priors[offset + 1] = cy;
          priors[offset + 2] = sKx;
          priors[offset + 3] = sKy;
          offset += 4;
        }
      }
    }
  }

  if (clipPriors) {
    for (let i = 0; i < priors.length; i++) {
      priors[i] = Math.max(0, Math.min(1, priors[i]));
    }
  }

  return priors;
}
