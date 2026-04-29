import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "@playwright/test";

interface CliArgs {
  folders: string[];
  maxPerFolder: number;
  detectorModel?: "yolov12s-face" | "retinaface-10gf";
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      map.set(key, "true");
      continue;
    }
    map.set(key, value);
    i += 1;
  }

  const foldersRaw =
    map.get("folders") ??
    "C:\\EMK-Media\\2022\\2022 Geneva appartment;C:\\EMK-Media\\2022\\2022 Skiing";
  const folders = foldersRaw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const maxPerFolderRaw = Number.parseInt(map.get("maxPerFolder") ?? "15", 10);
  const maxPerFolder = Number.isFinite(maxPerFolderRaw) && maxPerFolderRaw > 0 ? maxPerFolderRaw : 15;
  const detectorModel = map.get("detectorModel") as
    | "yolov12s-face"
    | "retinaface-10gf"
    | undefined;

  if (folders.length === 0) {
    throw new Error("At least one folder is required (--folders \"C:\\a;C:\\b\")");
  }
  return { folders, maxPerFolder, detectorModel };
}

function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(fileName);
}

function listFolderImages(folderPath: string, maxPerFolder: number): string[] {
  if (!fs.existsSync(folderPath)) return [];
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const images = entries
    .filter((ent) => ent.isFile() && isImageFile(ent.name))
    .map((ent) => path.join(folderPath, ent.name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
  return images.slice(0, maxPerFolder);
}

async function run(): Promise<void> {
  const { folders, maxPerFolder, detectorModel } = parseArgs();
  const mainJsPath = path.resolve(__dirname, "../dist-electron/main.js");
  if (!fs.existsSync(mainJsPath)) {
    throw new Error(`Built app not found: ${mainJsPath}. Run: pnpm --filter @emk/desktop-media build`);
  }

  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "emk-face-perf-userdata-"));
  const runtimeRootPath = fs.mkdtempSync(path.join(os.tmpdir(), "emk-face-perf-runtime-"));
  const sampleByFolder = new Map<string, string[]>();
  for (const folder of folders) {
    sampleByFolder.set(folder, listFolderImages(folder, maxPerFolder));
  }

  console.log("Face detection pipeline perf diagnostics");
  console.log(`- detectorModel: ${detectorModel ?? "(current setting)"}`);
  console.log(`- maxPerFolder: ${maxPerFolder}`);
  for (const [folder, images] of sampleByFolder) {
    console.log(`- ${folder}`);
    console.log(`  images: ${images.length}`);
  }
  console.log("");

  const app = await electron.launch({
    args: [mainJsPath],
    env: {
      ...process.env,
      NODE_ENV: "test",
      EMK_DESKTOP_USER_DATA_PATH: userDataPath,
      EMK_DESKTOP_RUNTIME_ROOT_PATH: runtimeRootPath,
    },
  });

  try {
    const window = await app.firstWindow({ timeout: 180_000 });
    await window.waitForLoadState("domcontentloaded");

    if (detectorModel) {
      const modelEnsure = await window.evaluate(async (selectedModel) => {
        const settings = await window.desktopApi.getSettings();
        const nextFace = { ...settings.faceDetection, detectorModel: selectedModel };
        await window.desktopApi.saveSettings({ ...settings, faceDetection: nextFace });
        return window.desktopApi.ensureDetectorModel(selectedModel);
      }, detectorModel);
      if (!modelEnsure.success) {
        throw new Error(`ensureDetectorModel failed: ${modelEnsure.error ?? "unknown"}`);
      }
    }

    for (const [folder, images] of sampleByFolder) {
      console.log(`\nFolder: ${folder}`);
      if (images.length === 0) {
        console.log("  no images found");
        continue;
      }
      for (const imagePath of images) {
        const result = await window.evaluate(async (p) => {
          const started = performance.now();
          const out = await window.desktopApi.detectFacesForMediaItem(p);
          const elapsedMs = performance.now() - started;
          return { out, elapsedMs };
        }, imagePath);
        const elapsedSec = (result.elapsedMs / 1000).toFixed(2);
        const faceCount = result.out.success ? result.out.faceCount : -1;
        const okLabel = result.out.success ? "ok" : "fail";
        console.log(`  ${okLabel}  ${elapsedSec}s  faces=${faceCount}  ${path.basename(imagePath)}`);
      }
    }
  } finally {
    await app.close();
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(runtimeRootPath, { recursive: true, force: true });
  }
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`diagnose-face-detection-pipeline-perf failed: ${message}`);
  process.exitCode = 1;
});
