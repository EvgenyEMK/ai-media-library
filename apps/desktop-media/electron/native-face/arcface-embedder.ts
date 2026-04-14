import * as ort from "onnxruntime-node";
import type { FaceEmbeddingResult } from "../face-embedding";
import { loadImageRgb } from "./image-utils";
import { alignFace } from "./affine-warp";
import { getModelPath, isModelDownloaded } from "./model-manager";

const ARCFACE_MODEL_FILE = "w600k_r50.onnx";
const ARCFACE_INPUT_SIZE: [number, number] = [112, 112];

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let loadError: string | null = null;
let cachedModelName: string | null = null;
let cachedDimension: number | null = null;

function createSession(): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(getModelPath(ARCFACE_MODEL_FILE), {
    executionProviders: ["cpu"],
  });
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = createSession();
  }
  try {
    return await sessionPromise;
  } catch (err) {
    sessionPromise = null;
    loadError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function isNativeEmbedderReady(): boolean {
  return isModelDownloaded(ARCFACE_MODEL_FILE) && loadError === null;
}

export function getNativeEmbedderError(): string | null {
  return loadError;
}

export function resetNativeEmbedder(): void {
  sessionPromise = null;
  loadError = null;
  cachedModelName = null;
  cachedDimension = null;
}

export interface FaceForNativeEmbedding {
  bbox_xyxy: [number, number, number, number];
  landmarks_5: Array<[number, number]>;
}

/**
 * Generate face embeddings for pre-detected faces in an image.
 * Equivalent to Python sidecar POST /embed.
 */
export async function embedFacesNative(params: {
  imagePath: string;
  faces: FaceForNativeEmbedding[];
  signal?: AbortSignal;
}): Promise<{
  embeddings: FaceEmbeddingResult[];
  modelName: string;
  dimension: number;
}> {
  const { imagePath, faces, signal } = params;

  if (signal?.aborted) throw new Error("Face embedding cancelled");
  if (faces.length === 0) {
    return { embeddings: [], modelName: "w600k_r50", dimension: 512 };
  }

  const session = await getSession();
  const image = await loadImageRgb(imagePath);

  if (signal?.aborted) throw new Error("Face embedding cancelled");

  const embeddings: FaceEmbeddingResult[] = [];

  for (let idx = 0; idx < faces.length; idx++) {
    const face = faces[idx];
    if (!face.landmarks_5 || face.landmarks_5.length !== 5) continue;

    if (signal?.aborted) throw new Error("Face embedding cancelled");

    const aligned = alignFace(image, face.landmarks_5, ARCFACE_INPUT_SIZE);
    const tensor = preprocessArcFace(aligned.data, aligned.width, aligned.height);

    const inputName = session.inputNames[0];
    const ortTensor = new ort.Tensor("float32", tensor, [1, 3, ARCFACE_INPUT_SIZE[1], ARCFACE_INPUT_SIZE[0]]);
    const feeds: Record<string, ort.Tensor> = { [inputName]: ortTensor };
    const results = await session.run(feeds);

    const outputName = session.outputNames[0];
    const rawEmbedding = results[outputName].data as Float32Array;
    const embedding = l2Normalize(Array.from(rawEmbedding));

    if (!cachedDimension) {
      cachedDimension = embedding.length;
    }

    embeddings.push({
      face_index: idx,
      vector: embedding,
      dimension: embedding.length,
    });
  }

  const modelName = cachedModelName ?? "w600k_r50";
  const dimension = cachedDimension ?? 512;

  return { embeddings, modelName, dimension };
}

/**
 * Get info about the native embedding model.
 * Equivalent to Python sidecar GET /models (embedding portion).
 */
export async function getNativeEmbeddingModelInfo(): Promise<{
  modelName: string;
  dimension: number;
  loaded: boolean;
} | null> {
  if (!isModelDownloaded(ARCFACE_MODEL_FILE)) return null;

  try {
    const session = await getSession();
    const outputShape = session.outputNames.length > 0 ? 512 : 512;
    cachedModelName = "w600k_r50";
    cachedDimension = outputShape;
    return {
      modelName: "w600k_r50",
      dimension: outputShape,
      loaded: true,
    };
  } catch {
    return null;
  }
}

/**
 * Preprocess an aligned RGB face for ArcFace: RGB -> float32 [0,1],
 * normalize with mean/std (0.5, 0.5, 0.5), HWC -> NCHW.
 */
function preprocessArcFace(
  rgb: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const pixels = width * height;
  const tensor = new Float32Array(3 * pixels);

  for (let i = 0; i < pixels; i++) {
    const r = (rgb[i * 3] / 255.0 - 0.5) / 0.5;
    const g = (rgb[i * 3 + 1] / 255.0 - 0.5) / 0.5;
    const b = (rgb[i * 3 + 2] / 255.0 - 0.5) / 0.5;

    // CHW: channel planes
    tensor[i] = r;
    tensor[pixels + i] = g;
    tensor[pixels * 2 + i] = b;
  }

  return tensor;
}

function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const v of vec) sumSq += v * v;
  if (sumSq === 0) return vec;
  const norm = Math.sqrt(sumSq);
  return vec.map((v) => v / norm);
}
