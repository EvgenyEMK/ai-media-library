import { Jimp } from "jimp";

export interface RawImage {
  /** Raw pixel data in RGB byte order, row-major. */
  data: Uint8Array;
  width: number;
  height: number;
  channels: 3;
}

/** Decode an image file into raw RGB pixels using Jimp. */
export async function loadImageRgb(imagePath: string): Promise<RawImage> {
  const image = await Jimp.read(imagePath);
  const { width, height } = image;
  const rgba = image.bitmap.data;
  const rgb = new Uint8Array(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }

  return { data: rgb, width, height, channels: 3 };
}

/**
 * Convert an RGB image to a BGR float32 CHW tensor with mean subtraction.
 * Output shape: (1, 3, H, W) as flat Float32Array.
 */
export function rgbToBgrFloat32CHW(
  image: RawImage,
  bgrMean: [number, number, number],
): Float32Array {
  const { width, height, data } = image;
  const pixels = width * height;
  const tensor = new Float32Array(3 * pixels);

  const bPlane = 0;
  const gPlane = pixels;
  const rPlane = pixels * 2;

  for (let i = 0; i < pixels; i++) {
    const rOff = i * 3;
    tensor[rPlane + i] = data[rOff] - bgrMean[2];
    tensor[gPlane + i] = data[rOff + 1] - bgrMean[1];
    tensor[bPlane + i] = data[rOff + 2] - bgrMean[0];
  }

  return tensor;
}

/**
 * Extract a rectangular crop from a raw RGB image.
 * Clamps to image bounds.
 */
export function cropRgb(
  image: RawImage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): RawImage {
  const cx1 = Math.max(0, Math.floor(x1));
  const cy1 = Math.max(0, Math.floor(y1));
  const cx2 = Math.min(image.width, Math.ceil(x2));
  const cy2 = Math.min(image.height, Math.ceil(y2));

  const w = cx2 - cx1;
  const h = cy2 - cy1;
  if (w <= 0 || h <= 0) {
    return { data: new Uint8Array(0), width: 0, height: 0, channels: 3 };
  }

  const out = new Uint8Array(w * h * 3);
  for (let row = 0; row < h; row++) {
    const srcOff = ((cy1 + row) * image.width + cx1) * 3;
    const dstOff = row * w * 3;
    out.set(image.data.subarray(srcOff, srcOff + w * 3), dstOff);
  }

  return { data: out, width: w, height: h, channels: 3 };
}

/**
 * Resize an RGB image to target dimensions using bilinear interpolation.
 */
export function resizeRgb(
  image: RawImage,
  targetW: number,
  targetH: number,
): RawImage {
  const { width: srcW, height: srcH, data: src } = image;
  if (srcW === targetW && srcH === targetH) {
    return { data: new Uint8Array(src), width: srcW, height: srcH, channels: 3 };
  }

  const out = new Uint8Array(targetW * targetH * 3);
  const xRatio = srcW / targetW;
  const yRatio = srcH / targetH;

  for (let y = 0; y < targetH; y++) {
    const srcY = y * yRatio;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const fy = srcY - y0;

    for (let x = 0; x < targetW; x++) {
      const srcX = x * xRatio;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const fx = srcX - x0;

      const dstOff = (y * targetW + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v00 = src[(y0 * srcW + x0) * 3 + c];
        const v01 = src[(y0 * srcW + x1) * 3 + c];
        const v10 = src[(y1 * srcW + x0) * 3 + c];
        const v11 = src[(y1 * srcW + x1) * 3 + c];

        out[dstOff + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) +
          v01 * fx * (1 - fy) +
          v10 * (1 - fx) * fy +
          v11 * fx * fy,
        );
      }
    }
  }

  return { data: out, width: targetW, height: targetH, channels: 3 };
}
