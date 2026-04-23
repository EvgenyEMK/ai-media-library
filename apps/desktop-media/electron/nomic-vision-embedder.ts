import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { resolveCacheRoot } from "./app-paths";
import { embedImageWithDecodeFallback } from "./nomic-vision-image-decode";

let visionPipelineInstance: ReturnType<typeof createVisionPipeline> | null = null;
let textPipelineInstance: ReturnType<typeof createTextPipeline> | null = null;
let rawImageClass: ReturnType<typeof createRawImagePromise> | null = null;
let loadError: string | null = null;

let transformersEnvConfigured: Promise<void> | null = null;

function getTransformersCacheDirs(): { cacheDir: string; localModelPath: string } {
  const runtimeCacheRoot = resolveCacheRoot(app);
  const hfRoot = path.join(runtimeCacheRoot, "huggingface");
  return {
    cacheDir: path.join(hfRoot, "cache"),
    localModelPath: path.join(hfRoot, "models"),
  };
}

function ensureTransformersEnvConfigured(): Promise<void> {
  if (!transformersEnvConfigured) {
    transformersEnvConfigured = (async () => {
      const { env } = await import("@huggingface/transformers");
      const dirs = getTransformersCacheDirs();
      await fs.mkdir(dirs.cacheDir, { recursive: true });
      await fs.mkdir(dirs.localModelPath, { recursive: true });
      // Packaged Electron reads app code from app.asar; explicit filesystem cache/model
      // roots avoid ENOTDIR path resolution failures in transformers warmup.
      env.cacheDir = dirs.cacheDir;
      env.localModelPath = dirs.localModelPath;
      env.allowRemoteModels = true;
      env.allowLocalModels = true;
      // Types mark `wasm` read-only; runtime allows configuring ORT wasm memory cap.
      const onnx = env.backends.onnx as unknown as {
        wasm?: { maxMemoryUsageInMB?: number };
      };
      const cap = 4096;
      if (!onnx.wasm) {
        onnx.wasm = { maxMemoryUsageInMB: cap };
      } else {
        onnx.wasm.maxMemoryUsageInMB = Math.max(onnx.wasm.maxMemoryUsageInMB ?? 2048, cap);
      }
    })();
  }
  return transformersEnvConfigured;
}

const NOMIC_VISION_MODEL = "nomic-ai/nomic-embed-vision-v1.5";
const NOMIC_TEXT_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const QUANTIZED = true;

type FeatureExtractionPipeline = (
  inputs: unknown,
  options?: Record<string, unknown>,
) => Promise<{ data: Float32Array; dims: number[] }>;

type RawImageConstructor = {
  new (data: Uint8ClampedArray, width: number, height: number, channels: number): unknown;
  fromBlob(blob: Blob): Promise<unknown>;
};

function createVisionPipeline(): Promise<FeatureExtractionPipeline> {
  return (async () => {
    await ensureTransformersEnvConfigured();
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = true;
    const pipelineOptions: Record<string, unknown> = {};
    if (QUANTIZED) {
      pipelineOptions.quantized = true;
    }
    const pipe = await pipeline("image-feature-extraction", NOMIC_VISION_MODEL, pipelineOptions);
    return pipe as unknown as FeatureExtractionPipeline;
  })();
}

function createTextPipeline(): Promise<FeatureExtractionPipeline> {
  return (async () => {
    await ensureTransformersEnvConfigured();
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = true;
    const pipelineOptions: Record<string, unknown> = {};
    if (QUANTIZED) {
      pipelineOptions.quantized = true;
    }
    const pipe = await pipeline("feature-extraction", NOMIC_TEXT_MODEL, pipelineOptions);
    return pipe as unknown as FeatureExtractionPipeline;
  })();
}

function createRawImagePromise(): Promise<RawImageConstructor> {
  return (async () => {
    await ensureTransformersEnvConfigured();
    const { RawImage } = await import("@huggingface/transformers");
    return RawImage as unknown as RawImageConstructor;
  })();
}

async function getVisionPipeline(): Promise<FeatureExtractionPipeline> {
  if (!visionPipelineInstance) {
    visionPipelineInstance = createVisionPipeline();
  }
  try {
    return await visionPipelineInstance;
  } catch (err) {
    visionPipelineInstance = null;
    loadError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

async function getTextPipeline(): Promise<FeatureExtractionPipeline> {
  if (!textPipelineInstance) {
    textPipelineInstance = createTextPipeline();
  }
  try {
    return await textPipelineInstance;
  } catch (err) {
    textPipelineInstance = null;
    loadError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

async function getRawImage(): Promise<RawImageConstructor> {
  if (!rawImageClass) {
    rawImageClass = createRawImagePromise();
  }
  return rawImageClass;
}

const WARMUP_IMAGE_SIZE = 224;

/**
 * One real forward pass so ONNX/WASM session compile completes before batch work.
 * Matches the `embedImageDirect` → `pipe(image)` path (RawImage RGBA constructor).
 */
async function runVisionInferenceWarmup(): Promise<void> {
  const pipe = await getVisionPipeline();
  const RawImageCls = await getRawImage();
  const w = WARMUP_IMAGE_SIZE;
  const h = WARMUP_IMAGE_SIZE;
  const rgba = new Uint8ClampedArray(w * h * 4);
  rgba.fill(0);
  const image = new RawImageCls(rgba, w, h, 4);
  const output = await pipe(image);
  const dims = output.dims;
  const embeddingDim = dims[dims.length - 1];
  if (embeddingDim <= 0 || output.data.length < embeddingDim) {
    throw new Error("Vision warmup produced invalid output shape");
  }
}

/**
 * Embed an image using the ONNX nomic-embed-vision-v1.5 model.
 * Extracts the CLS token embedding and L2-normalizes it.
 */
export async function embedImageDirect(
  imagePath: string,
  signal?: AbortSignal,
): Promise<number[]> {
  if (signal?.aborted) {
    throw new Error("Aborted before vision embedding started");
  }

  const pipe = await getVisionPipeline();
  const RawImageCls = await getRawImage();
  return embedImageWithDecodeFallback(pipe, RawImageCls, imagePath);
}

/**
 * Embed text using the ONNX nomic-embed-text-v1.5 model.
 * Applies mean pooling and L2-normalizes the result.
 * Automatically prepends the `search_query:` task prefix.
 */
export async function embedTextDirect(
  text: string,
  signal?: AbortSignal,
): Promise<number[]> {
  if (signal?.aborted) {
    throw new Error("Aborted before text embedding started");
  }

  const pipe = await getTextPipeline();
  const prefixedText = `search_query: ${text}`;
  const output = await pipe(prefixedText, { pooling: "mean" });

  const raw = Array.from(output.data);
  return normalizeVector(raw);
}

/**
 * Embed text using the ONNX nomic-embed-text-v1.5 model for document indexing.
 * Uses the `search_document:` task prefix (vs `search_query:` for queries).
 * This ensures embeddings are in the correct part of the latent space for
 * asymmetric retrieval (query vs document).
 */
export async function embedTextForDocument(
  text: string,
  signal?: AbortSignal,
): Promise<number[]> {
  if (signal?.aborted) {
    throw new Error("Aborted before document text embedding started");
  }

  const pipe = await getTextPipeline();
  const prefixedText = `search_document: ${text}`;
  const output = await pipe(prefixedText, { pooling: "mean" });

  const raw = Array.from(output.data);
  return normalizeVector(raw);
}

/**
 * Eagerly loads the vision pipeline and RawImage class, then runs one inference
 * so session compile / first-run setup finishes before real catalog images.
 */
export async function warmupVisionPipeline(): Promise<void> {
  await getVisionPipeline();
  await getRawImage();
  await runVisionInferenceWarmup();
}

/**
 * Reports whether the vision pipeline is (or is expected to be) available.
 * Does NOT eagerly load the model — actual loading happens on first
 * embedImageDirect() call. This avoids heavy I/O on app startup that
 * would compete with the metadata scan triggered by folder selection.
 */
export async function probeVisionEmbeddingReady(): Promise<boolean> {
  if (visionPipelineInstance) {
    try {
      await visionPipelineInstance;
      return true;
    } catch {
      return false;
    }
  }
  return loadError === null;
}

export async function probeTextEmbeddingReady(): Promise<boolean> {
  try {
    await getTextPipeline();
    return true;
  } catch {
    return false;
  }
}

export function getVisionEmbedderError(): string | null {
  return loadError;
}

export function getVisionModelId(): string {
  return NOMIC_VISION_MODEL;
}

export function getTextModelId(): string {
  return NOMIC_TEXT_MODEL;
}

function normalizeVector(values: number[]): number[] {
  let sumSquares = 0;
  for (const v of values) {
    sumSquares += v * v;
  }
  if (sumSquares === 0) return values;
  const norm = Math.sqrt(sumSquares);
  return values.map((v) => v / norm);
}
