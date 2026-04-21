import * as ort from "onnxruntime-node";
import type { FaceEmbeddingResult } from "../face-embedding";
import { cropRgb, loadImageRgb, resizeRgb, rotateRgb } from "./image-utils";
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
  landmarks_5?: Array<[number, number]>;
  preferredRotationClockwise?: 0 | 90 | 180 | 270;
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

    if (signal?.aborted) throw new Error("Face embedding cancelled");

    const hasLandmarks =
      Array.isArray(face.landmarks_5) && face.landmarks_5.length === 5;
    const aligned = hasLandmarks
      ? alignFace(image, face.landmarks_5 as Array<[number, number]>, ARCFACE_INPUT_SIZE)
      : alignFaceFromBoundingBox(image, face.bbox_xyxy, ARCFACE_INPUT_SIZE);

    const embedding = hasLandmarks
      ? await inferSingleEmbedding(session, aligned)
      : await inferEmbeddingWithoutLandmarks(
          session,
          aligned,
          face.preferredRotationClockwise,
        );

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

async function inferSingleEmbedding(
  session: ort.InferenceSession,
  aligned: { data: Uint8Array; width: number; height: number },
): Promise<number[]> {
  const tensor = preprocessArcFace(aligned.data, aligned.width, aligned.height);
  const inputName = session.inputNames[0];
  const ortTensor = new ort.Tensor("float32", tensor, [1, 3, ARCFACE_INPUT_SIZE[1], ARCFACE_INPUT_SIZE[0]]);
  const feeds: Record<string, ort.Tensor> = { [inputName]: ortTensor };
  const results = await session.run(feeds);
  const outputName = session.outputNames[0];
  const rawEmbedding = results[outputName].data as Float32Array;
  return l2Normalize(Array.from(rawEmbedding));
}

async function inferRotationAwareEmbedding(
  session: ort.InferenceSession,
  aligned: { data: Uint8Array; width: number; height: number; channels: 3 },
): Promise<number[]> {
  const candidates = [
    aligned,
    rotateRgb(aligned, 90),
    rotateRgb(aligned, 270),
  ];
  const embeddings = await Promise.all(
    candidates.map((candidate) => inferSingleEmbedding(session, candidate)),
  );
  const dim = embeddings[0]?.length ?? 0;
  if (dim === 0) return [];
  const sum = new Array<number>(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      sum[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    sum[i] /= embeddings.length;
  }
  return l2Normalize(sum);
}

const ENABLE_ROTATION_SWEEP_FALLBACK =
  process.env.EMK_DESKTOP_FACE_EMBED_ROTATION_SWEEP === "1";

async function inferEmbeddingWithoutLandmarks(
  session: ort.InferenceSession,
  aligned: { data: Uint8Array; width: number; height: number; channels: 3 },
  preferredRotationClockwise?: 0 | 90 | 180 | 270,
): Promise<number[]> {
  if (
    preferredRotationClockwise === 90 ||
    preferredRotationClockwise === 180 ||
    preferredRotationClockwise === 270
  ) {
    return inferSingleEmbedding(
      session,
      rotateRgb(aligned, preferredRotationClockwise),
    );
  }
  if (ENABLE_ROTATION_SWEEP_FALLBACK) {
    return inferRotationAwareEmbedding(session, aligned);
  }
  return inferSingleEmbedding(session, aligned);
}

function alignFaceFromBoundingBox(
  image: { data: Uint8Array; width: number; height: number; channels: 3 },
  bbox: [number, number, number, number],
  target: [number, number],
): { data: Uint8Array; width: number; height: number; channels: 3 } {
  const [x1, y1, x2, y2] = bbox;
  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);
  // Add context around face to compensate for missing alignment landmarks.
  const padX = w * 0.2;
  const padY = h * 0.25;
  const crop = cropRgb(image, x1 - padX, y1 - padY, x2 + padX, y2 + padY);
  if (crop.width <= 0 || crop.height <= 0) {
    // Fallback to entire frame if bbox is degenerate.
    return resizeRgb(image, target[0], target[1]);
  }
  return resizeRgb(crop, target[0], target[1]);
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
