#!/usr/bin/env node
/**
 * Downloads ONNX face / aux weights into ./ai-models/ at the repo root.
 * Keep URL lists in sync with apps/desktop-media/electron/native-face/model-manager.ts
 *
 * Does not fetch: Ollama LLM weights, or @huggingface/transformers caches for
 * Nomic vision/text (those load on first use into HF cache).
 *
 * Usage: node scripts/download-ai-models.mjs [--force]
 */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "ai-models");

/** @type {{ filename: string; urls: string[] }[]} */
const MODELS = [
  {
    filename: "w600k_r50.onnx",
    urls: [
      "https://huggingface.co/maze/faceX/resolve/main/w600k_r50.onnx",
      "https://huggingface.co/ll00292007/easyphoto/resolve/main/w600k_r50.onnx",
    ],
  },
  {
    filename: "retinaface_mv2.onnx",
    urls: [
      "https://github.com/yakhyo/retinaface-pytorch/releases/download/v0.0.1/retinaface_mv2.onnx",
    ],
  },
  {
    filename: "yolov12n-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12n-face.onnx",
    ],
  },
  {
    filename: "yolov12s-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12s-face.onnx",
    ],
  },
  {
    filename: "yolov12m-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12m-face.onnx",
    ],
  },
  {
    filename: "yolov12l-face.onnx",
    urls: [
      "https://github.com/akanametov/yolo-face/releases/download/1.0.0/yolov12l-face.onnx",
    ],
  },
  {
    filename: "deep-image-orientation.onnx",
    urls: [
      "https://huggingface.co/DuarteBarbosa/deep-image-orientation-detection/resolve/main/orientation_model_v2_0.9882.onnx",
    ],
  },
  {
    filename: "pfld_ghostone.onnx",
    urls: [
      "https://huggingface.co/shadow-cann/hispark-modelzoo-pfld/resolve/main/pfld-sim.onnx",
      "https://huggingface.co/AnthonyF333/PFLD_GhostOne/resolve/main/pfld_ghostone.onnx",
      "https://github.com/AnthonyF333/PFLD_GhostOne/releases/download/v1.0/pfld_ghostone.onnx",
    ],
  },
  {
    filename: "age-gender.onnx",
    urls: [
      "https://huggingface.co/onnx-community/age-gender-prediction-ONNX/resolve/main/onnx/model.onnx",
    ],
  },
];

const force = process.argv.includes("--force");

async function downloadOne(filename, urls) {
  const dest = path.join(OUT_DIR, filename);
  if (!force && existsSync(dest)) {
    const st = await stat(dest);
    if (st.size > 1024) {
      console.log(`skip (exists): ${filename} (${st.size} bytes)`);
      return;
    }
  }

  let lastErr = null;
  for (const url of urls) {
    const tmp = `${dest}.part`;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "ai-media-library-download-ai-models/1.0" },
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} ${url}`);
        continue;
      }
      if (!res.body) {
        lastErr = new Error(`No body: ${url}`);
        continue;
      }
      const readable = Readable.fromWeb(res.body);
      const writer = createWriteStream(tmp);
      await pipeline(readable, writer);
      await import("node:fs/promises").then(({ rename }) => rename(tmp, dest));
      const st = await stat(dest);
      console.log(`ok: ${filename} <- ${url} (${st.size} bytes)`);
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      try {
        await import("node:fs/promises").then(({ unlink }) => unlink(tmp));
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr ?? new Error(`Failed: ${filename}`);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Output: ${OUT_DIR}\n`);

let failed = 0;
for (const m of MODELS) {
  try {
    await downloadOne(m.filename, m.urls);
  } catch (e) {
    console.error(`FAIL: ${m.filename}:`, e.message);
    failed++;
  }
}

if (failed) {
  process.exit(1);
}
