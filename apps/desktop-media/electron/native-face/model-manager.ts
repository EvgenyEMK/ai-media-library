import fs from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline as streamPipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const MODEL_URLS: Record<string, string[]> = {
  "retinaface_mv2.onnx": [
    "https://github.com/yakhyo/retinaface-pytorch/releases/download/v0.0.1/retinaface_mv2.onnx",
  ],
  "w600k_r50.onnx": [
    "https://huggingface.co/maze/faceX/resolve/main/w600k_r50.onnx",
    "https://huggingface.co/ll00292007/easyphoto/resolve/main/w600k_r50.onnx",
  ],
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

export function areAllModelsDownloaded(): boolean {
  return Object.keys(MODEL_URLS).every((f) => isModelDownloaded(f));
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
  const urls = MODEL_URLS[filename];
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
 * Ensure all required ONNX models are present, downloading any missing ones.
 */
export async function ensureModelsDownloaded(
  onProgress?: DownloadProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  const startedAt = Date.now();
  for (const filename of Object.keys(MODEL_URLS)) {
    if (!isModelDownloaded(filename)) {
      await downloadModel(filename, onProgress, signal);
    }
  }
  console.log(
    `[emk-face][models] all-ready durationMs=${Date.now() - startedAt}`,
  );
}

export function getModelFilenames(): string[] {
  return Object.keys(MODEL_URLS);
}
