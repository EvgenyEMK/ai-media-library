import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "../../src/shared/ipc";

const YIELD_EVERY = 40;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export function sigFromSortedLines(lines: string[]): string {
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/**
 * Walk `rootFolderPath` and collect per-directory mtime, sorted subdir names, and sorted media lines
 * `name|mtimeMs|size` for direct image/video children.
 */
export async function collectDiskFolderQuickScanLayout(rootFolderPath: string): Promise<{
  folderDirMtimes: Map<string, number>;
  folderSubdirs: Map<string, string[]>;
  folderMediaLines: Map<string, string[]>;
}> {
  const root = path.normalize(rootFolderPath.trim());
  const folderDirMtimes = new Map<string, number>();
  const folderSubdirs = new Map<string, string[]>();
  const folderMediaLines = new Map<string, string[]>();

  const queue: string[] = [root];
  const seen = new Set<string>();
  let processed = 0;

  while (queue.length > 0) {
    const dir = queue.shift();
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    processed += 1;
    if (processed % YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }

    let dst: Awaited<ReturnType<typeof fs.stat>>;
    try {
      dst = await fs.stat(dir);
    } catch {
      continue;
    }
    if (!dst.isDirectory()) continue;

    folderDirMtimes.set(dir, Math.trunc(dst.mtimeMs));

    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = (await fs.readdir(dir, { withFileTypes: true })) as Array<{
        name: string;
        isDirectory(): boolean;
        isFile(): boolean;
      }>;
    } catch {
      folderSubdirs.set(dir, []);
      folderMediaLines.set(dir, []);
      continue;
    }

    const subdirNames: string[] = [];
    const mediaLines: string[] = [];

    for (const ent of entries) {
      if (ent.isDirectory()) {
        subdirNames.push(ent.name);
        queue.push(path.join(dir, ent.name));
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext)) continue;
      const fp = path.join(dir, ent.name);
      try {
        const st = await fs.stat(fp);
        if (!st.isFile()) continue;
        const m = Math.trunc(st.mtimeMs);
        const sz = st.size;
        mediaLines.push(`${ent.name}|${m}|${sz}`);
      } catch {
        continue;
      }
    }

    subdirNames.sort((a, b) => a.localeCompare(b));
    mediaLines.sort((a, b) => a.localeCompare(b));
    folderSubdirs.set(dir, subdirNames);
    folderMediaLines.set(dir, mediaLines);
  }

  return { folderDirMtimes, folderSubdirs, folderMediaLines };
}
