import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { migrateAiModelsLayoutPaths } from "./migrate-ai-models-layout";

async function mkFixtureRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "emk-ai-models-migrate-"));
}

describe("migrateAiModelsLayoutPaths", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("moves managed ONNX files from ai-models root into onnx/", async () => {
    const root = await mkFixtureRoot();
    roots.push(root);
    const aiModelsRoot = path.join(root, "EMK Desktop Media", "ai-models");
    const onnxDir = path.join(aiModelsRoot, "onnx");
    const cacheRoot = path.join(root, "EMK Desktop Media", "cache");
    const huggingfaceRoot = path.join(aiModelsRoot, "huggingface");

    await fs.mkdir(aiModelsRoot, { recursive: true });
    await fs.writeFile(path.join(aiModelsRoot, "w600k_r50.onnx"), "x");

    await migrateAiModelsLayoutPaths({
      aiModelsRoot,
      cacheRoot,
      onnxDir,
      huggingfaceRoot,
    });

    expect(existsSync(path.join(onnxDir, "w600k_r50.onnx"))).toBe(true);
    expect(existsSync(path.join(aiModelsRoot, "w600k_r50.onnx"))).toBe(false);
    expect(existsSync(huggingfaceRoot)).toBe(true);
  });

  it("renames cache/huggingface to ai-models/huggingface when destination is absent", async () => {
    const root = await mkFixtureRoot();
    roots.push(root);
    const aiModelsRoot = path.join(root, "EMK Desktop Media", "ai-models");
    const onnxDir = path.join(aiModelsRoot, "onnx");
    const cacheRoot = path.join(root, "EMK Desktop Media", "cache");
    const huggingfaceRoot = path.join(aiModelsRoot, "huggingface");
    const oldHf = path.join(cacheRoot, "huggingface");

    await fs.mkdir(cacheRoot, { recursive: true });
    await fs.mkdir(path.join(oldHf, "cache"), { recursive: true });
    await fs.writeFile(path.join(oldHf, "cache", "blob.bin"), "hf");

    await migrateAiModelsLayoutPaths({
      aiModelsRoot,
      cacheRoot,
      onnxDir,
      huggingfaceRoot,
    });

    expect(existsSync(oldHf)).toBe(false);
    expect(existsSync(path.join(huggingfaceRoot, "cache", "blob.bin"))).toBe(true);
  });

  it("is a no-op when onnx files are already under onnx and cache huggingface is gone", async () => {
    const root = await mkFixtureRoot();
    roots.push(root);
    const aiModelsRoot = path.join(root, "EMK Desktop Media", "ai-models");
    const onnxDir = path.join(aiModelsRoot, "onnx");
    const cacheRoot = path.join(root, "EMK Desktop Media", "cache");
    const huggingfaceRoot = path.join(aiModelsRoot, "huggingface");

    await fs.mkdir(onnxDir, { recursive: true });
    await fs.writeFile(path.join(onnxDir, "w600k_r50.onnx"), "onnx");
    await fs.mkdir(path.join(huggingfaceRoot, "models"), { recursive: true });
    await fs.writeFile(path.join(huggingfaceRoot, "models", "keep.txt"), "m");

    await migrateAiModelsLayoutPaths({
      aiModelsRoot,
      cacheRoot,
      onnxDir,
      huggingfaceRoot,
    });

    expect(existsSync(path.join(onnxDir, "w600k_r50.onnx"))).toBe(true);
    expect(existsSync(path.join(huggingfaceRoot, "models", "keep.txt"))).toBe(true);
    expect(existsSync(path.join(cacheRoot, "huggingface"))).toBe(false);
  });
});
