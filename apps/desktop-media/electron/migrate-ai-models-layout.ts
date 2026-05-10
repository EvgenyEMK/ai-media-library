import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";

import {
  resolveCacheRoot,
  resolveHuggingfaceModelsRoot,
  resolveModelsPath,
  resolveOnnxModelsPath,
} from "./app-paths";
import { listAllManagedOnnxFilenames } from "./native-face/model-manager";

async function isDirectoryEmpty(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir);
  return entries.length === 0;
}

/**
 * Merge files/dirs from `fromDir` into `toDir`. When both sides have the same
 * file name, the destination is kept. Recurses into directories.
 */
async function mergeDirectoryContents(fromDir: string, toDir: string): Promise<void> {
  const entries = await fs.readdir(fromDir, { withFileTypes: true });
  for (const ent of entries) {
    const from = path.join(fromDir, ent.name);
    const to = path.join(toDir, ent.name);
    if (ent.isDirectory()) {
      if (!existsSync(to)) {
        await fs.rename(from, to);
      } else {
        const st = await fs.stat(to);
        if (st.isDirectory()) {
          await mergeDirectoryContents(from, to);
          await fs.rm(from, { recursive: true, force: true });
        }
      }
    } else if (!existsSync(to)) {
      await fs.rename(from, to);
    }
  }
}

export interface MigrateAiModelsLayoutPaths {
  aiModelsRoot: string;
  cacheRoot: string;
  onnxDir: string;
  huggingfaceRoot: string;
}

/**
 * Moves legacy flat ONNX files into `onnx/` and relocates `cache/huggingface`
 * to `ai-models/huggingface`. Safe to call on every startup (no-op when already migrated).
 */
export async function migrateAiModelsLayoutPaths(
  paths: MigrateAiModelsLayoutPaths,
): Promise<void> {
  const { aiModelsRoot, cacheRoot, onnxDir, huggingfaceRoot } = paths;

  await fs.mkdir(onnxDir, { recursive: true });

  for (const filename of listAllManagedOnnxFilenames()) {
    const atRoot = path.join(aiModelsRoot, filename);
    const atOnnx = path.join(onnxDir, filename);
    if (existsSync(atRoot) && !existsSync(atOnnx)) {
      await fs.rename(atRoot, atOnnx);
    }
  }

  const oldHuggingface = path.join(cacheRoot, "huggingface");
  if (!existsSync(oldHuggingface)) {
    await fs.mkdir(huggingfaceRoot, { recursive: true });
    return;
  }

  if (!existsSync(huggingfaceRoot)) {
    await fs.rename(oldHuggingface, huggingfaceRoot);
    return;
  }

  if (await isDirectoryEmpty(huggingfaceRoot)) {
    await fs.rm(huggingfaceRoot, { recursive: true });
    await fs.rename(oldHuggingface, huggingfaceRoot);
    return;
  }

  await mergeDirectoryContents(oldHuggingface, huggingfaceRoot);
  await fs.rm(oldHuggingface, { recursive: true, force: true });
}

export async function migrateAiModelsLayout(app: App): Promise<void> {
  await migrateAiModelsLayoutPaths({
    aiModelsRoot: resolveModelsPath(app),
    cacheRoot: resolveCacheRoot(app),
    onnxDir: resolveOnnxModelsPath(app),
    huggingfaceRoot: resolveHuggingfaceModelsRoot(app),
  });
}
