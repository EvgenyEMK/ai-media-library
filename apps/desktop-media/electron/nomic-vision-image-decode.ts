import fs from "node:fs/promises";

type RawImageConstructor = {
  new (data: Uint8ClampedArray, width: number, height: number, channels: number): unknown;
  fromBlob(blob: Blob): Promise<unknown>;
};

type PipelineOutput = { data: Float32Array; dims: number[] };

type VisionPipe = (inputs: unknown, options?: Record<string, unknown>) => Promise<PipelineOutput>;

/** Avoid HF/sharp `fromBlob` for JPEG — it often throws "marker was not found" on phone/camera files while Jimp decodes them. */
const JPEG_PATH_RE = /\.jpe?g$/i;

export function isJpegFilePath(imagePath: string): boolean {
  return JPEG_PATH_RE.test(imagePath);
}

export async function loadImageViaBlob(
  RawImageCls: RawImageConstructor,
  imagePath: string,
): Promise<unknown> {
  const imageBytes = await fs.readFile(imagePath);
  const blob = new Blob([imageBytes]);
  return RawImageCls.fromBlob(blob);
}

export async function loadImageViaJimp(
  RawImageCls: RawImageConstructor,
  imagePath: string,
): Promise<unknown> {
  const { Jimp } = await import("jimp");
  const jimpImage = await Jimp.read(imagePath);
  const { width, height } = jimpImage;
  const raw = jimpImage.bitmap.data;
  const rgba =
    raw instanceof Uint8ClampedArray ? raw : new Uint8ClampedArray(raw);
  return new RawImageCls(rgba, width, height, 4);
}

async function loadImageViaNativeImage(
  RawImageCls: RawImageConstructor,
  imagePath: string,
): Promise<unknown> {
  const { nativeImage } = await import("electron");
  const ni = nativeImage.createFromPath(imagePath);
  if (ni.isEmpty()) {
    throw new Error("nativeImage returned empty image");
  }
  const { width, height } = ni.getSize();
  if (!width || !height) {
    throw new Error(`nativeImage returned invalid size width=${width} height=${height}`);
  }
  const bgra = ni.toBitmap();
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < bgra.length; i += 4) {
    rgba[i] = bgra[i + 2] ?? 0;
    rgba[i + 1] = bgra[i + 1] ?? 0;
    rgba[i + 2] = bgra[i] ?? 0;
    rgba[i + 3] = bgra[i + 3] ?? 255;
  }
  return new RawImageCls(rgba, width, height, 4);
}

function clsEmbeddingFromOutput(output: PipelineOutput): number[] {
  const dims = output.dims;
  const embeddingDim = dims[dims.length - 1];
  return Array.from(output.data.slice(0, embeddingDim) as Float32Array);
}

export function normalizeVisionEmbedding(values: number[]): number[] {
  let sumSquares = 0;
  for (const v of values) {
    sumSquares += v * v;
  }
  if (sumSquares === 0) return values;
  const norm = Math.sqrt(sumSquares);
  return values.map((v) => v / norm);
}

/**
 * - JPEG/JPEG: decode with Jimp only (bypasses HF `fromBlob`/sharp that fails on many real camera JPEGs).
 * - Other formats: `fromBlob` first, then Jimp on decode or inference failure.
 */
export async function embedImageWithDecodeFallback(
  pipe: VisionPipe,
  RawImageCls: RawImageConstructor,
  imagePath: string,
): Promise<number[]> {
  const jpeg = isJpegFilePath(imagePath);

  let viaJimp = false;
  let image: unknown;

  if (jpeg) {
    try {
      image = await loadImageViaJimp(RawImageCls, imagePath);
      viaJimp = true;
    } catch (err) {
      try {
        image = await loadImageViaNativeImage(RawImageCls, imagePath);
        viaJimp = true;
      } catch {
        throw err;
      }
    }
  } else {
    try {
      image = await loadImageViaBlob(RawImageCls, imagePath);
    } catch {
      image = await loadImageViaJimp(RawImageCls, imagePath);
      viaJimp = true;
    }
  }

  try {
    const output = await pipe(image);
    return normalizeVisionEmbedding(clsEmbeddingFromOutput(output));
  } catch (err) {
    if (viaJimp) {
      throw err;
    }
    image = await loadImageViaJimp(RawImageCls, imagePath);
    const output = await pipe(image);
    return normalizeVisionEmbedding(clsEmbeddingFromOutput(output));
  }
}
