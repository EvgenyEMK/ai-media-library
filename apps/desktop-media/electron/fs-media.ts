import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  type FolderNode,
  type MediaKind,
  type MediaLibraryItem,
  type MediaImageItem,
} from "../src/shared/ipc";

export async function readFolderChildren(folderPath: string): Promise<FolderNode[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  const nodes = await Promise.all(
    directories.map(async (entry) => {
      const childPath = path.join(folderPath, entry.name);
      const hasSubdirectories = await folderHasSubdirectories(childPath);
      return {
        path: childPath,
        name: entry.name,
        hasSubdirectories,
      };
    }),
  );

  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readDirectFolderChildren(folderPath: string): Promise<Array<{ path: string; name: string }>> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      path: path.join(folderPath, entry.name),
      name: entry.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listFolderImages(
  folderPath: string,
): Promise<MediaImageItem[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  const images = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const absolutePath = path.join(folderPath, entry.name);
      return {
        path: absolutePath,
        name: entry.name,
        url: pathToFileURL(absolutePath).toString(),
      };
    });

  return images.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listFolderVideos(folderPath: string): Promise<MediaImageItem[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  const videos = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const absolutePath = path.join(folderPath, entry.name);
      return {
        path: absolutePath,
        name: entry.name,
        url: pathToFileURL(absolutePath).toString(),
      };
    });

  return videos.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listFolderMedia(
  folderPath: string,
): Promise<MediaLibraryItem[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  const media = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const extension = path.extname(entry.name).toLowerCase();
      let mediaKind: MediaKind | null = null;
      if (IMAGE_EXTENSIONS.has(extension)) {
        mediaKind = "image";
      } else if (VIDEO_EXTENSIONS.has(extension)) {
        mediaKind = "video";
      }
      if (!mediaKind) {
        return null;
      }
      const absolutePath = path.join(folderPath, entry.name);
      return {
        path: absolutePath,
        name: entry.name,
        url: pathToFileURL(absolutePath).toString(),
        mediaKind,
      } satisfies MediaLibraryItem;
    })
    .filter((entry): entry is MediaLibraryItem => entry !== null);

  return media.sort((a, b) => a.name.localeCompare(b.name));
}

interface StreamFolderImagesOptions {
  batchSize?: number;
}

interface StreamFolderMediaOptions {
  batchSize?: number;
}

export async function streamFolderImages(
  folderPath: string,
  onBatch: (items: MediaImageItem[]) => Promise<void> | void,
  options?: StreamFolderImagesOptions,
): Promise<{ loaded: number }> {
  const batchSize = Math.max(1, options?.batchSize ?? 80);
  const maxBatchDelayMs = 120;
  const dir = await fs.opendir(folderPath);
  const batch: MediaImageItem[] = [];
  let loaded = 0;
  let lastBatchAt = Date.now();

  for await (const entry of dir) {
    if (!entry.isFile()) continue;
    if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    const absolutePath = path.join(folderPath, entry.name);
    batch.push({
      path: absolutePath,
      name: entry.name,
      url: pathToFileURL(absolutePath).toString(),
    });

    const now = Date.now();
    if (batch.length >= batchSize || (batch.length > 0 && now - lastBatchAt >= maxBatchDelayMs)) {
      await onBatch([...batch]);
      loaded += batch.length;
      batch.length = 0;
      lastBatchAt = now;
    }
  }

  if (batch.length > 0) {
    await onBatch([...batch]);
    loaded += batch.length;
  }

  return { loaded };
}

export async function streamFolderMedia(
  folderPath: string,
  onBatch: (items: MediaLibraryItem[]) => Promise<void> | void,
  options?: StreamFolderMediaOptions,
): Promise<{ loaded: number }> {
  const batchSize = Math.max(1, options?.batchSize ?? 80);
  const maxBatchDelayMs = 120;
  const dir = await fs.opendir(folderPath);
  const batch: MediaLibraryItem[] = [];
  let loaded = 0;
  let lastBatchAt = Date.now();

  for await (const entry of dir) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    let mediaKind: MediaKind | null = null;
    if (IMAGE_EXTENSIONS.has(extension)) {
      mediaKind = "image";
    } else if (VIDEO_EXTENSIONS.has(extension)) {
      mediaKind = "video";
    }
    if (!mediaKind) continue;

    const absolutePath = path.join(folderPath, entry.name);
    batch.push({
      path: absolutePath,
      name: entry.name,
      url: pathToFileURL(absolutePath).toString(),
      mediaKind,
    });

    const now = Date.now();
    if (batch.length >= batchSize || (batch.length > 0 && now - lastBatchAt >= maxBatchDelayMs)) {
      await onBatch([...batch]);
      loaded += batch.length;
      batch.length = 0;
      lastBatchAt = now;
    }
  }

  if (batch.length > 0) {
    await onBatch([...batch]);
    loaded += batch.length;
  }

  return { loaded };
}

async function folderHasSubdirectories(folderPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory());
  } catch {
    return false;
  }
}
