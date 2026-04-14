import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { getDesktopDatabase } from "./db/client";
import { DEFAULT_LIBRARY_ID } from "./db/folder-analysis-status";

const FACE_CROPS_DIR_NAME = "face-crops";

export function getFaceCropsDir(): string {
  return path.join(app.getPath("userData"), FACE_CROPS_DIR_NAME);
}

export async function ensureFaceCropsDir(): Promise<string> {
  const dir = getFaceCropsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function getCropFilePath(faceInstanceId: string): string {
  return path.join(getFaceCropsDir(), `${faceInstanceId}.jpg`);
}

export async function saveFaceCropToFile(
  faceInstanceId: string,
  cropBase64: string,
): Promise<string> {
  const dir = await ensureFaceCropsDir();
  const cropPath = path.join(dir, `${faceInstanceId}.jpg`);
  const buffer = Buffer.from(cropBase64, "base64");
  await fs.writeFile(cropPath, buffer);
  return cropPath;
}

export function updateFaceCropPath(
  faceInstanceId: string,
  cropPath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_face_instances
     SET crop_path = ?, updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(cropPath, now, faceInstanceId, libraryId);
}

export async function deleteFaceCropFile(
  cropPath: string | null | undefined,
): Promise<void> {
  if (!cropPath) return;
  try {
    await fs.unlink(cropPath);
  } catch {
    // File may not exist; ignore
  }
}

export async function deleteFaceCropById(faceInstanceId: string): Promise<void> {
  const cropPath = getCropFilePath(faceInstanceId);
  await deleteFaceCropFile(cropPath);
}
