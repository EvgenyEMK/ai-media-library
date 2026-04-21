import fs from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline as streamPipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import type { FaceDetectorModelId } from "../../src/shared/ipc";

/**
 * Models that every face-related feature depends on regardless of which
 * face detector the user selects. Currently just the ArcFace embedder.
 */
const CORE_MODEL_URLS: Record<string, string[]> = {
  "w600k_r50.onnx": [
    "https://huggingface.co/maze/faceX/resolve/main/w600k_r50.onnx",
    "https://huggingface.co/ll00292007/easyphoto/resolve/main/w600k_r50.onnx",
  ],
};

interface DetectorModelDescriptor {
  filename: string;
  urls: string[];
}

/**
 * Per-variant detector weights. All YOLO variants are pre-exported ONNX files
 * hosted on the akanametov/yolo-face GitHub release. RetinaFace comes from a
 * separate repository release.
 */
const DETECTOR_MODELS: Record<FaceDetectorModelId, DetectorModelDescriptor> = {
  retinaface: {
    filename: "retinaface_mv2.onnx",
    urls: [
      "https://github.com/yakhyo/retinaface-pytorch/releases/download/v0.0.1/retinaface_mv2.onnx",
    ],
  },
  "yolov12n-face": {
    filename: "yolov12n-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12n-face.onnx",
    ],
  },
  "yolov12s-face": {
    filename: "yolov12s-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12s-face.onnx",
    ],
  },
  "yolov12m-face": {
    filename: "yolov12m-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12m-face.onnx",
    ],
  },
  "yolov12l-face": {
    filename: "yolov12l-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12l-face.onnx",
    ],
  },
};

let modelsDir: string | null = null;

export function setModelsDirectory(dir: string): void {
  modelsDir = dir;
}

export function getModelsDirectory(): string {
  if (!modelsDir) {
    throw new Error(
      "Models directory not configured. Call setModelsDirectory() first.",
    );
  }
  return modelsDir;
}

export function getModelPath(filename: string): string {
  return path.join(getModelsDirectory(), filename);
}

export function isModelDownloaded(filename: string): boolean {
  return existsSync(getModelPath(filename));
}

export function getDetectorModelFilename(detector: FaceDetectorModelId): string {
  return DETECTOR_MODELS[detector].filename;
}

export function isDetectorModelDownloaded(detector: FaceDetectorModelId): boolean {
  return isModelDownloaded(getDetectorModelFilename(detector));
}

export function listAllDetectorModelFilenames(): string[] {
  return Object.values(DETECTOR_MODELS).map((d) => d.filename);
}

export function listCoreModelFilenames(): string[] {
  return Object.keys(CORE_MODEL_URLS);
}

/**
 * Combined lookup for the download function below.
 */
function resolveUrls(filename: string): string[] | null {
  if (CORE_MODEL_URLS[filename]) return CORE_MODEL_URLS[filename];
  for (const descriptor of Object.values(DETECTOR_MODELS)) {
    if (descriptor.filename === filename) return descriptor.urls;
  }
  return null;
}

export type DownloadProgressCallback = (info: {
  filename: string;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}) => void;

/**
 * Download a single model file. Tries each mirror URL in order.
 * Returns the local path on success.
 */
export async function downloadModel(
  filename: string,
  onProgress?: DownloadProgressCallback,
  signal?: AbortSignal,
): Promise<string> {
  const startedAt = Date.now();
  console.log(`[emk-face][models] download-start file=${filename}`);
  const urls = resolveUrls(filename);
  if (!urls || urls.length === 0) {
    throw new Error(`Unknown model filename: ${filename}`);
  }

  const dir = getModelsDirectory();
  await fs.mkdir(dir, { recursive: true });
  const destPath = path.join(dir, filename);
  const tempPath = `${destPath}.tmp`;

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }

      const totalBytes = response.headers.get("content-length");
      const totalSize = totalBytes ? parseInt(totalBytes, 10) : null;

      if (!response.body) {
        lastError = new Error(`No response body from ${url}`);
        continue;
      }

      const readable = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
      const writer = createWriteStream(tempPath);

      let downloadedBytes = 0;
      readable.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        onProgress?.({
          filename,
          downloadedBytes,
          totalBytes: totalSize,
          percent: totalSize ? Math.round((downloadedBytes / totalSize) * 100) : null,
        });
      });

      await streamPipeline(readable, writer);
      await fs.rename(tempPath, destPath);
      console.log(
        `[emk-face][models] download-done file=${filename} durationMs=${Date.now() - startedAt}`,
      );
      return destPath;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      try { await fs.unlink(tempPath); } catch { /* ignore */ }
      if (signal?.aborted) throw lastError;
    }
  }

  throw lastError ?? new Error(`Failed to download ${filename}`);
}

/**
 * Ensure core models (the ArcFace embedder) plus the currently active
 * detector are present, downloading any missing ones.
 */
export async function ensureActiveModels(
  activeDetector: FaceDetectorModelId,
  onProgress?: DownloadProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  const startedAt = Date.now();
  for (const filename of Object.keys(CORE_MODEL_URLS)) {
    if (!isModelDownloaded(filename)) {
      await downloadModel(filename, onProgress, signal);
    }
  }
  await ensureDetectorModel(activeDetector, onProgress, signal);
  console.log(
    `[emk-face][models] all-ready detector=${activeDetector} durationMs=${Date.now() - startedAt}`,
  );
}

/**
 * Ensure the ONNX weights for the given detector are on disk, downloading
 * them if needed. No-op when already cached.
 */
export async function ensureDetectorModel(
  detector: FaceDetectorModelId,
  onProgress?: DownloadProgressCallback,
  signal?: AbortSignal,
): Promise<{ alreadyPresent: boolean }> {
  const filename = getDetectorModelFilename(detector);
  if (isModelDownloaded(filename)) {
    return { alreadyPresent: true };
  }
  await downloadModel(filename, onProgress, signal);
  return { alreadyPresent: false };
}

export function areCoreModelsDownloaded(): boolean {
  return Object.keys(CORE_MODEL_URLS).every((f) => isModelDownloaded(f));
}

/**
 * Legacy helper name retained for backwards compatibility with callers
 * that have not yet migrated to `areCoreModelsDownloaded` + active-detector
 * readiness.
 */
export function areAllModelsDownloaded(): boolean {
  return areCoreModelsDownloaded();
}

/**
 * Legacy helper kept for the startup code path that existed before
 * multi-detector support; ensures the RetinaFace + ArcFace pair that the
 * desktop app has always shipped. Prefer `ensureActiveModels`.
 */
export async function ensureModelsDownloaded(
  onProgress?: DownloadProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  await ensureActiveModels("retinaface", onProgress, signal);
}

export function getModelFilenames(): string[] {
  return [...Object.keys(CORE_MODEL_URLS), ...listAllDetectorModelFilenames()];
}
