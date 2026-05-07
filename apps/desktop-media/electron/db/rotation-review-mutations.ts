import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Jimp } from "jimp";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { buildAppliedRotationMetadata } from "./rotation-review-ai-metadata";
import { mapAabbQuarterTurn, type QuarterTurnAngle } from "./rotation-review-geometry";

interface MediaItemRotationRow {
  id: string;
  library_id: string;
  source_path: string;
  width: number | null;
  height: number | null;
  ai_metadata: string | null;
}

interface FaceInstanceRow {
  id: string;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
  bbox_ref_width: number | null;
  bbox_ref_height: number | null;
}

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

function getOrientation(metadata: Record<string, unknown>): Record<string, unknown> {
  const orientation = metadata.orientation_detection;
  return orientation && typeof orientation === "object" && !Array.isArray(orientation)
    ? { ...(orientation as Record<string, unknown>) }
    : {};
}

function toJimpRotationDegrees(angleClockwise: QuarterTurnAngle): number {
  return angleClockwise === 90 ? 270 : angleClockwise === 270 ? 90 : 180;
}

function getFiniteDimension(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

async function rotateImageFileInPlace(sourcePath: string, angleClockwise: QuarterTurnAngle): Promise<{
  width: number;
  height: number;
  byteSize: number;
  mtimeMs: number;
}> {
  const imageBytes = await fs.readFile(sourcePath);
  const image = await Jimp.read(imageBytes);
  image.rotate(toJimpRotationDegrees(angleClockwise));
  const ext = path.extname(sourcePath);
  const tempPath = path.join(
    path.dirname(sourcePath),
    `.${path.basename(sourcePath, ext)}.rotate-${randomUUID()}${ext}`,
  );
  try {
    await image.write(tempPath as `${string}.${string}`);
    await fs.rename(tempPath, sourcePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
  const stat = await fs.stat(sourcePath);
  return {
    width: image.bitmap.width,
    height: image.bitmap.height,
    byteSize: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

function buildDismissedMetadata(raw: string | null): string {
  const metadata = parseJsonObject(raw);
  const orientation = getOrientation(metadata);
  const dismissedAt = new Date().toISOString();
  metadata.wrong_rotation_user_dismissed = {
    dismissed_at: dismissedAt,
    permanent: true,
  };
  metadata.orientation_detection = {
    ...orientation,
    user_dismissed: {
      dismissed_at: dismissedAt,
      permanent: true,
    },
  };
  return JSON.stringify(metadata);
}

function remapFaceBoxes(params: {
  mediaItemId: string;
  libraryId: string;
  sourceWidth: number;
  sourceHeight: number;
  angleClockwise: QuarterTurnAngle;
}): void {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT id, bbox_x, bbox_y, bbox_width, bbox_height, bbox_ref_width, bbox_ref_height
       FROM media_face_instances
       WHERE library_id = ? AND media_item_id = ?`,
    )
    .all(params.libraryId, params.mediaItemId) as FaceInstanceRow[];
  const update = db.prepare(
    `UPDATE media_face_instances
     SET bbox_x = ?, bbox_y = ?, bbox_width = ?, bbox_height = ?,
         bbox_ref_width = ?, bbox_ref_height = ?, landmarks_json = NULL, updated_at = ?
     WHERE id = ?`,
  );
  const now = new Date().toISOString();
  for (const row of rows) {
    const refWidth = getFiniteDimension(row.bbox_ref_width) ?? params.sourceWidth;
    const refHeight = getFiniteDimension(row.bbox_ref_height) ?? params.sourceHeight;
    if (
      row.bbox_x === null ||
      row.bbox_y === null ||
      row.bbox_width === null ||
      row.bbox_height === null
    ) {
      continue;
    }
    const rotated = mapAabbQuarterTurn(
      { x: row.bbox_x, y: row.bbox_y, width: row.bbox_width, height: row.bbox_height },
      { width: refWidth, height: refHeight },
      params.angleClockwise,
    );
    update.run(
      rotated.box.x,
      rotated.box.y,
      rotated.box.width,
      rotated.box.height,
      rotated.ref.width,
      rotated.ref.height,
      now,
      row.id,
    );
  }
}

function getMediaItem(mediaItemId: string): MediaItemRotationRow | null {
  const row = getDesktopDatabase()
    .prepare(
      `SELECT id, library_id, source_path, width, height, ai_metadata
       FROM media_items
       WHERE id = ? AND library_id = ? AND deleted_at IS NULL
       LIMIT 1`,
    )
    .get(mediaItemId, DEFAULT_LIBRARY_ID) as MediaItemRotationRow | undefined;
  return row ?? null;
}

export async function applyWrongRotationToMediaItem(params: {
  mediaItemId: string;
  angleClockwise: QuarterTurnAngle;
}): Promise<{ success: true } | { success: false; error: string }> {
  const row = getMediaItem(params.mediaItemId);
  if (!row) return { success: false, error: "Media item was not found." };
  const sourceWidth = getFiniteDimension(row.width);
  const sourceHeight = getFiniteDimension(row.height);
  if (sourceWidth === null || sourceHeight === null) {
    return { success: false, error: "Image dimensions are missing; refresh metadata and try again." };
  }

  try {
    const rotated = await rotateImageFileInPlace(row.source_path, params.angleClockwise);
    const db = getDesktopDatabase();
    const tx = db.transaction(() => {
      remapFaceBoxes({
        mediaItemId: row.id,
        libraryId: row.library_id,
        sourceWidth,
        sourceHeight,
        angleClockwise: params.angleClockwise,
      });
      db.prepare(
        `UPDATE media_items
         SET width = ?, height = ?, byte_size = ?, file_mtime_ms = ?,
             ai_metadata = ?, content_hash = NULL, checksum_sha256 = NULL, updated_at = ?
         WHERE id = ? AND library_id = ?`,
      ).run(
        rotated.width,
        rotated.height,
        rotated.byteSize,
        rotated.mtimeMs,
        buildAppliedRotationMetadata(row.ai_metadata, params.angleClockwise, {
          width: sourceWidth,
          height: sourceHeight,
        }),
        new Date().toISOString(),
        row.id,
        row.library_id,
      );
    });
    tx();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rotate image file.";
    return { success: false, error: message };
  }
}

export function dismissWrongRotationSuggestion(params: {
  mediaItemId: string;
}): { success: true } | { success: false; error: string } {
  const row = getMediaItem(params.mediaItemId);
  if (!row) return { success: false, error: "Media item was not found." };
  getDesktopDatabase()
    .prepare(
      `UPDATE media_items
       SET ai_metadata = ?, updated_at = ?
       WHERE id = ? AND library_id = ?`,
    )
    .run(buildDismissedMetadata(row.ai_metadata), new Date().toISOString(), row.id, row.library_id);
  return { success: true };
}
