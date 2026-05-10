import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";

import {
  resolveCacheRoot,
  resolveHuggingfaceModelsRoot,
  resolveLegacyRuntimeRoot,
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
  legacyAiModelsRoot?: string;
  legacyCacheRoot?: string;
}

/**
 * Moves legacy flat ONNX files into `onnx/` and relocates `cache/huggingface`
 * to `ai-models/huggingface`. Safe to call on every startup (no-op when already migrated).
 */
export async function migrateAiModelsLayoutPaths(
  paths: MigrateAiModelsLayoutPaths,
): Promise<void> {
  const {
    aiModelsRoot,
    cacheRoot,
    onnxDir,
    huggingfaceRoot,
    legacyAiModelsRoot,
    legacyCacheRoot,
  } = paths;

  if (legacyAiModelsRoot && legacyAiModelsRoot !== aiModelsRoot && existsSync(legacyAiModelsRoot)) {
    await fs.mkdir(aiModelsRoot, { recursive: true });
    await mergeDirectoryContents(legacyAiModelsRoot, aiModelsRoot);
  }

  await fs.mkdir(onnxDir, { recursive: true });

  for (const filename of listAllManagedOnnxFilenames()) {
    const atRoot = path.join(aiModelsRoot, filename);
    const atOnnx = path.join(onnxDir, filename);
    if (existsSync(atRoot) && !existsSync(atOnnx)) {
      await fs.rename(atRoot, atOnnx);
    }
  }

  const migratedCurrentCache = await migrateHuggingfaceCache(cacheRoot, huggingfaceRoot);
  const migratedLegacyCache =
    legacyCacheRoot && legacyCacheRoot !== cacheRoot
      ? await migrateHuggingfaceCache(legacyCacheRoot, huggingfaceRoot)
      : false;

  if (!migratedCurrentCache && !migratedLegacyCache) {
    await fs.mkdir(huggingfaceRoot, { recursive: true });
  }
}

async function migrateHuggingfaceCache(cacheRoot: string, huggingfaceRoot: string): Promise<boolean> {
  const oldHuggingface = path.join(cacheRoot, "huggingface");
  if (!existsSync(oldHuggingface)) {
    return false;
  }
  if (!existsSync(huggingfaceRoot)) {
    await fs.rename(oldHuggingface, huggingfaceRoot);
    return true;
  }

  if (await isDirectoryEmpty(huggingfaceRoot)) {
    await fs.rm(huggingfaceRoot, { recursive: true });
    await fs.rename(oldHuggingface, huggingfaceRoot);
    return true;
  }

  await mergeDirectoryContents(oldHuggingface, huggingfaceRoot);
  await fs.rm(oldHuggingface, { recursive: true, force: true });
  return true;
}

export async function migrateAiModelsLayout(app: App): Promise<void> {
  const legacyRuntimeRoot = resolveLegacyRuntimeRoot(app);
  await migrateAiModelsLayoutPaths({
    aiModelsRoot: resolveModelsPath(app),
    cacheRoot: resolveCacheRoot(app),
    onnxDir: resolveOnnxModelsPath(app),
    huggingfaceRoot: resolveHuggingfaceModelsRoot(app),
    legacyAiModelsRoot: path.join(legacyRuntimeRoot, "ai-models"),
    legacyCacheRoot: path.join(legacyRuntimeRoot, "cache"),
  });
}
