import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import ExifReader from "exifreader";
import {
  createExifReaderDomParser,
  extractTechnicalCaptureFromUnknown,
  inferMimeTypeFromPath,
  mergeMetadataV2,
  normalizeMetadata,
  parseExifMetadataFromExpandedTags,
} from "@emk/media-metadata-core";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert } from "./media-ai-invalidation-guards";
import { invalidateMediaItemAiAfterMetadataRefresh } from "./media-ai-invalidation";
import type { ObservedFileState } from "./file-identity";
import { upsertSource } from "./media-item-sources";
import { syncFtsForMediaItem } from "./keyword-search";
import {
  inferCatalogMediaKind,
  type DesktopMediaItemMetadata,
  type DesktopPhotoTakenPrecision,
  type MediaKind,
  VIDEO_EXTENSIONS,
} from "../../src/shared/ipc";
import { extractVideoMetadataWithExifTool } from "../lib/extract-video-metadata-exiftool";

export type { DesktopMediaItemMetadata } from "../../src/shared/ipc";

const METADATA_VERSION = "desktop-photo-metadata-v2";

/** SQLite default SQLITE_MAX_VARIABLE_NUMBER is often 999; keep IN lists under that (incl. library_id). */
const METADATA_BY_PATHS_QUERY_CHUNK = 900;

interface ExtractedPhotoMetadata {
  width: number | null;
  height: number | null;
  orientation: number | null;
  photoTakenAt: string | null;
  photoTakenPrecision: DesktopPhotoTakenPrecision | null;
  fileCreatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  mimeType: string | null;
  metadataError: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLengthMm: number | null;
  fNumber: number | null;
  exposureTime: string | null;
  iso: number | null;
  metadataModifiedAt: string | null;
  embeddedTitle: string | null;
  embeddedDescription: string | null;
  embeddedLocation: string | null;
  starRating: number | null;
  videoDurationSec: number | null;
}

export interface UpsertMediaItemResult {
  path: string;
  name: string;
  status: "created" | "updated" | "unchanged" | "failed";
  mediaItemId: string | null;
  error?: string;
  /**
   * True when AI pipelines should run or re-run: new catalog row, or catalog refresh
   * invalidated prior AI (see `invalidateMediaItemAiAfterMetadataRefresh`). Metadata-only
   * updates that do not invalidate are false even when status is `updated`.
   */
  needsAiPipelineFollowUp?: boolean;
  /** EXIF-derived fields forwarded for path extraction pipeline. */
  photoTakenAt?: string | null;
  photoTakenPrecision?: string | null;
  fileCreatedAt?: string | null;
}

export async function upsertMediaItemFromFilePath(params: {
  filePath: string;
  observedState?: ObservedFileState;
  libraryId?: string;
  /**
   * When set (0–5), use this star rating instead of EXIF/XMP extraction for this upsert.
   * Use after writing rating to the file so the catalog matches user intent even if ExifReader lags the embed.
   */
  overrideStarRating?: number;
  /**
   * When true, skip AI invalidation if width/height/orientation match the prior row (caller attests
   * an embedded-metadata-only file touch). Use only after trusted ExifTool-style writes.
   */
  trustedEmbeddedMetadataWrite?: boolean;
}): Promise<UpsertMediaItemResult> {
  const { filePath } = params;
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const db = getDesktopDatabase();

  const observedState = params.observedState ?? (await getObservedStateFromFs(filePath));
  const contentHash = observedState?.strongHash ?? null;

  const existingByPath = db
    .prepare(
      `SELECT
         id,
         file_mtime_ms,
         byte_size,
         metadata_version,
         ai_metadata,
         content_hash,
         width,
         height,
         orientation
       FROM media_items
       WHERE library_id = ? AND source_path = ?
       LIMIT 1`,
    )
    .get(libraryId, filePath) as
    | {
        id: string;
        file_mtime_ms: number | null;
        byte_size: number | null;
        metadata_version: string | null;
        ai_metadata: string | null;
        content_hash: string | null;
        width: number | null;
        height: number | null;
        orientation: number | null;
      }
    | undefined;

  const existingByHash =
    !existingByPath && contentHash
      ? (db
          .prepare(
            `SELECT id, ai_metadata
             FROM media_items
             WHERE library_id = ? AND content_hash = ? AND deleted_at IS NULL
             LIMIT 1`,
          )
          .get(libraryId, contentHash) as
          | { id: string; ai_metadata: string | null }
          | undefined)
      : undefined;

  const existing = existingByPath ?? existingByHash;
  const isDuplicateLink = !existingByPath && !!existingByHash;

  const currentMtime = observedState?.mtimeMs ?? null;
  const currentSize = observedState?.fileSize ?? null;
  const contentHashChanged =
    !!existingByPath &&
    typeof contentHash === "string" &&
    contentHash.length > 0 &&
    contentHash !== existingByPath.content_hash;
  const requiresRefresh =
    isDuplicateLink ||
    !existing ||
    contentHashChanged ||
    (existingByPath &&
      existingByPath.file_mtime_ms === currentMtime &&
      existingByPath.byte_size === currentSize &&
      existingByPath.metadata_version === METADATA_VERSION) === false;

  if (!requiresRefresh && existingByPath) {
    return {
      path: filePath,
      name: path.basename(filePath),
      status: "unchanged",
      mediaItemId: existingByPath.id,
      needsAiPipelineFollowUp: false,
    };
  }

  const now = new Date().toISOString();
  const extracted = await extractCatalogFileMetadata(filePath, observedState);
  const metadata =
    typeof params.overrideStarRating === "number" &&
    Number.isInteger(params.overrideStarRating) &&
    params.overrideStarRating >= 0 &&
    params.overrideStarRating <= 5
      ? { ...extracted, starRating: params.overrideStarRating }
      : extracted;
  const catalogMediaKind: MediaKind = inferCatalogMediaKind(filePath, metadata.mimeType);
  const isImageKind = catalogMediaKind === "image";
  const baseName = path.basename(filePath);
  /**
   * Duplicate-by-content (`isDuplicateLink`) must use a new primary key: reusing the existing row's
   * `id` while inserting a different `source_path` violates `media_items.id` uniqueness (the upsert
   * only conflicts on `(library_id, source_path)`). Each path gets its own `media_items` row; we
   * still merge AI metadata from the hash-matched row when present.
   */
  const itemId = existingByPath?.id ?? randomUUID();
  const nextAiMetadata = buildDesktopAiMetadata(
    existing?.ai_metadata ?? null,
    metadata,
    now,
    filePath,
  );

  try {
    const contentHash = observedState?.strongHash ?? null;

    db.prepare(
      `INSERT INTO media_items (
        id,
        library_id,
        source_path,
        filename,
        mime_type,
        width,
        height,
        byte_size,
        file_mtime_ms,
        orientation,
        file_created_at,
        checksum_sha256,
        content_hash,
        photo_taken_at,
        photo_taken_precision,
        star_rating,
        latitude,
        longitude,
        media_kind,
        video_duration_sec,
        metadata_extracted_at,
        metadata_version,
        metadata_error,
        duplicate_group_id,
        ai_metadata,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(library_id, source_path) DO UPDATE SET
        filename = excluded.filename,
        mime_type = excluded.mime_type,
        width = excluded.width,
        height = excluded.height,
        byte_size = excluded.byte_size,
        file_mtime_ms = excluded.file_mtime_ms,
        orientation = excluded.orientation,
        file_created_at = excluded.file_created_at,
        checksum_sha256 = excluded.checksum_sha256,
        content_hash = COALESCE(excluded.content_hash, media_items.content_hash),
        photo_taken_at = excluded.photo_taken_at,
        photo_taken_precision = excluded.photo_taken_precision,
        star_rating = excluded.star_rating,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        media_kind = excluded.media_kind,
        video_duration_sec = excluded.video_duration_sec,
        metadata_extracted_at = excluded.metadata_extracted_at,
        metadata_version = excluded.metadata_version,
        metadata_error = excluded.metadata_error,
        duplicate_group_id = excluded.duplicate_group_id,
        ai_metadata = excluded.ai_metadata,
        deleted_at = NULL,
        updated_at = excluded.updated_at`,
    ).run(
      itemId,
      libraryId,
      filePath,
      baseName,
      metadata.mimeType,
      metadata.width,
      metadata.height,
      currentSize,
      currentMtime,
      metadata.orientation,
      metadata.fileCreatedAt,
      contentHash,
      contentHash,
      metadata.photoTakenAt,
      metadata.photoTakenPrecision,
      metadata.starRating,
      metadata.latitude,
      metadata.longitude,
      catalogMediaKind,
      metadata.videoDurationSec,
      now,
      METADATA_VERSION,
      metadata.metadataError,
      observedState?.duplicateGroupId ?? null,
      nextAiMetadata,
      now,
      now,
    );

    upsertSource({
      mediaItemId: itemId,
      sourcePath: filePath,
      isPrimary: true,
      libraryId,
    });

    try {
      syncFtsForMediaItem(itemId, libraryId);
    } catch {
      // FTS sync is best-effort
    }

    let didInvalidateAi = false;
    if (existingByPath && isImageKind) {
      const nextCatalog = {
        content_hash: contentHash,
        width: metadata.width,
        height: metadata.height,
        orientation: metadata.orientation,
        byte_size: currentSize,
        file_mtime_ms: currentMtime,
      };
      if (
        shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
          prior: {
            content_hash: existingByPath.content_hash,
            width: existingByPath.width,
            height: existingByPath.height,
            orientation: existingByPath.orientation,
            byte_size: existingByPath.byte_size,
            file_mtime_ms: existingByPath.file_mtime_ms,
          },
          next: nextCatalog,
          trustedEmbeddedMetadataWrite: params.trustedEmbeddedMetadataWrite,
        })
      ) {
        invalidateMediaItemAiAfterMetadataRefresh({ mediaItemId: itemId, libraryId });
        didInvalidateAi = true;
      }
    }

    const needsAiPipelineFollowUp =
      isImageKind && (!existingByPath || didInvalidateAi) && !isDuplicateLink;

    return {
      path: filePath,
      name: baseName,
      status: existingByPath ? "updated" : "created",
      mediaItemId: itemId,
      needsAiPipelineFollowUp,
      photoTakenAt: metadata.photoTakenAt,
      photoTakenPrecision: metadata.photoTakenPrecision,
      fileCreatedAt: metadata.fileCreatedAt,
    };
  } catch (error) {
    return {
      path: filePath,
      name: baseName,
      status: "failed",
      mediaItemId: existing?.id ?? null,
      needsAiPipelineFollowUp: false,
      error: error instanceof Error ? error.message : "Failed to upsert media metadata",
    };
  }
}

type MediaItemMetadataRow = {
  id: string;
  source_path: string;
  filename: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  file_mtime_ms: number | null;
  orientation: number | null;
  file_created_at: string | null;
  photo_taken_at: string | null;
  photo_taken_precision: string | null;
  event_date_start: string | null;
  event_date_end: string | null;
  star_rating: number | null;
  latitude: number | null;
  longitude: number | null;
  media_kind: string | null;
  video_duration_sec: number | null;
  country: string | null;
  city: string | null;
  location_area: string | null;
  location_place: string | null;
  location_name: string | null;
  display_title: string | null;
  checksum_sha256: string | null;
  content_hash: string | null;
  duplicate_group_id: string | null;
  metadata_extracted_at: string | null;
  metadata_version: string | null;
  metadata_error: string | null;
  ai_metadata: string | null;
  updated_at: string;
  source_count: number;
};

export function getMediaItemMetadataByPaths(
  paths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, DesktopMediaItemMetadata> {
  if (paths.length === 0) {
    return {};
  }

  const db = getDesktopDatabase();
  const rows: MediaItemMetadataRow[] = [];
  for (let i = 0; i < paths.length; i += METADATA_BY_PATHS_QUERY_CHUNK) {
    const chunk = paths.slice(i, i + METADATA_BY_PATHS_QUERY_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const chunkRows = db
      .prepare(
        `SELECT
           mi.id,
           mi.source_path,
           mi.filename,
           mi.mime_type,
           mi.width,
           mi.height,
           mi.byte_size,
           mi.file_mtime_ms,
           mi.orientation,
           mi.file_created_at,
           mi.photo_taken_at,
           mi.photo_taken_precision,
           mi.event_date_start,
           mi.event_date_end,
           mi.star_rating,
           mi.latitude,
           mi.longitude,
           mi.media_kind,
           mi.video_duration_sec,
           mi.country,
           mi.city,
           mi.location_area,
           mi.location_place,
           mi.location_name,
           mi.display_title,
           mi.checksum_sha256,
           mi.content_hash,
           mi.duplicate_group_id,
           mi.metadata_extracted_at,
           mi.metadata_version,
           mi.metadata_error,
           mi.ai_metadata,
           mi.updated_at,
           COALESCE(sc.active_count, 0) AS source_count
         FROM media_items mi
         LEFT JOIN (
           SELECT media_item_id, COUNT(*) AS active_count
           FROM media_item_sources
           WHERE status = 'active'
           GROUP BY media_item_id
         ) sc ON sc.media_item_id = mi.id
         WHERE mi.library_id = ?
           AND mi.deleted_at IS NULL
           AND mi.source_path IN (${placeholders})`,
      )
      .all(libraryId, ...chunk) as MediaItemMetadataRow[];
    rows.push(...chunkRows);
  }

  const rowIds = rows.map((row) => row.id);
  const faceConfidenceByMediaId = new Map<string, Array<number | null>>();
  if (rowIds.length > 0) {
    for (let i = 0; i < rowIds.length; i += METADATA_BY_PATHS_QUERY_CHUNK) {
      const chunk = rowIds.slice(i, i + METADATA_BY_PATHS_QUERY_CHUNK);
      const idPlaceholders = chunk.map(() => "?").join(", ");
      const confidenceRows = db
        .prepare(
          `SELECT
             media_item_id,
             confidence
           FROM media_face_instances
           WHERE library_id = ?
             AND source = 'auto'
             AND media_item_id IN (${idPlaceholders})
           ORDER BY media_item_id, rowid ASC`,
        )
        .all(libraryId, ...chunk) as Array<{
        media_item_id: string;
        confidence: number | null;
      }>;
      for (const confidenceRow of confidenceRows) {
        const current = faceConfidenceByMediaId.get(confidenceRow.media_item_id) ?? [];
        current.push(confidenceRow.confidence);
        faceConfidenceByMediaId.set(confidenceRow.media_item_id, current);
      }
    }
  }

  return rows.reduce<Record<string, DesktopMediaItemMetadata>>((acc, row) => {
    const parsedAi = parseJson(row.ai_metadata);
    const capture = extractTechnicalCaptureFromUnknown(parsedAi);
    const embedded = readEmbeddedStrings(parsedAi);
    const mediaKind: MediaKind =
      row.media_kind === "video" || row.media_kind === "image"
        ? row.media_kind
        : inferCatalogMediaKind(row.source_path, row.mime_type);
    const videoDurationSec =
      typeof row.video_duration_sec === "number" && Number.isFinite(row.video_duration_sec)
        ? row.video_duration_sec
        : null;
    acc[row.source_path] = {
      id: row.id,
      sourcePath: row.source_path,
      filename: row.filename,
      mimeType: row.mime_type,
      mediaKind,
      videoDurationSec,
      width: row.width,
      height: row.height,
      byteSize: row.byte_size,
      fileMtimeMs: row.file_mtime_ms,
      orientation: row.orientation,
      fileCreatedAt: row.file_created_at,
      photoTakenAt: row.photo_taken_at,
      photoTakenPrecision: parsePhotoTakenPrecisionColumn(row.photo_taken_precision),
      eventDateStart: row.event_date_start,
      eventDateEnd: row.event_date_end,
      embeddedTitle: embedded.title,
      embeddedDescription: embedded.description,
      embeddedLocation: embedded.locationText,
      starRating: typeof row.star_rating === "number" ? row.star_rating : null,
      latitude: row.latitude,
      longitude: row.longitude,
      country: row.country,
      city: row.city,
      locationArea: row.location_area,
      locationPlace: row.location_place,
      locationName: row.location_name,
      displayTitle: row.display_title,
      checksumSha256: row.checksum_sha256,
      contentHash: row.content_hash,
      duplicateGroupId: row.duplicate_group_id,
      metadataExtractedAt: row.metadata_extracted_at,
      metadataVersion: row.metadata_version,
      metadataError: row.metadata_error,
      cameraMake: capture?.camera_make ?? null,
      cameraModel: capture?.camera_model ?? null,
      lensModel: capture?.lens_model ?? null,
      focalLengthMm: capture?.focal_length_mm ?? null,
      fNumber: capture?.f_number ?? null,
      exposureTime: capture?.exposure_time ?? null,
      iso: capture?.iso ?? null,
      faceConfidences: faceConfidenceByMediaId.get(row.id) ?? [],
      sourceCount: row.source_count,
      updatedAt: row.updated_at,
      aiMetadata: parseJson(row.ai_metadata),
    };
    return acc;
  }, {});
}

async function extractCatalogFileMetadata(
  filePath: string,
  observedState?: ObservedFileState,
): Promise<ExtractedPhotoMetadata> {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) {
    const v = await extractVideoMetadataWithExifTool(
      filePath,
      toIsoDate(observedState?.mtimeMs ?? null),
    );
    return {
      width: v.width,
      height: v.height,
      orientation: v.orientation,
      photoTakenAt: v.photoTakenAt,
      photoTakenPrecision: v.photoTakenPrecision,
      fileCreatedAt: v.fileCreatedAt,
      latitude: v.latitude,
      longitude: v.longitude,
      mimeType: v.mimeType,
      metadataError: v.metadataError,
      cameraMake: v.cameraMake,
      cameraModel: v.cameraModel,
      lensModel: v.lensModel,
      focalLengthMm: v.focalLengthMm,
      fNumber: v.fNumber,
      exposureTime: v.exposureTime,
      iso: v.iso,
      metadataModifiedAt: v.metadataModifiedAt,
      embeddedTitle: v.embeddedTitle,
      embeddedDescription: v.embeddedDescription,
      embeddedLocation: v.embeddedLocation,
      starRating: v.starRating,
      videoDurationSec: v.videoDurationSec,
    };
  }
  const photo = await extractPhotoMetadata(filePath, observedState);
  return { ...photo, videoDurationSec: null };
}

async function getObservedStateFromFs(filePath: string): Promise<ObservedFileState | undefined> {
  try {
    const stat = await fs.stat(filePath);
    return {
      currentPath: filePath,
      fileSize: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs),
      ctimeMs: Math.trunc(stat.ctimeMs),
      quickFingerprint: `${stat.size}:${Math.trunc(stat.mtimeMs)}`,
      strongHash: null,
      duplicateGroupId: null,
      lastSeenAt: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

async function extractPhotoMetadata(
  filePath: string,
  observedState?: ObservedFileState,
): Promise<ExtractedPhotoMetadata> {
  const fallbackCreatedDate = toIsoDate(observedState?.mtimeMs ?? null);

  try {
    const buffer = await fs.readFile(filePath);
    const tags = await ExifReader.load(buffer, {
      expanded: true,
      domParser: createExifReaderDomParser(),
    });
    const exif = parseExifMetadataFromExpandedTags(tags, {
      fallbackMimeType: inferMimeTypeFromPath(filePath),
    });

    return {
      width: exif.width,
      height: exif.height,
      orientation: exif.orientation,
      photoTakenAt: exif.photoTakenAt,
      photoTakenPrecision: exif.photoTakenPrecision,
      fileCreatedAt: fallbackCreatedDate,
      latitude: exif.latitude,
      longitude: exif.longitude,
      mimeType: exif.mimeType,
      metadataError: null,
      cameraMake: exif.cameraMake,
      cameraModel: exif.cameraModel,
      lensModel: exif.lensModel,
      focalLengthMm: exif.focalLengthMm,
      fNumber: exif.fNumber,
      exposureTime: exif.exposureTime,
      iso: exif.iso,
      metadataModifiedAt: exif.metadataModifiedAt,
      embeddedTitle: exif.embeddedTitle,
      embeddedDescription: exif.embeddedDescription,
      embeddedLocation: exif.embeddedLocation,
      starRating: exif.starRating,
      videoDurationSec: null,
    };
  } catch (error) {
    return {
      width: null,
      height: null,
      orientation: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      fileCreatedAt: fallbackCreatedDate,
      latitude: null,
      longitude: null,
      mimeType: inferMimeTypeFromPath(filePath),
      metadataError: error instanceof Error ? error.message : "Failed to parse metadata",
      cameraMake: null,
      cameraModel: null,
      lensModel: null,
      focalLengthMm: null,
      fNumber: null,
      exposureTime: null,
      iso: null,
      metadataModifiedAt: null,
      embeddedTitle: null,
      embeddedDescription: null,
      embeddedLocation: null,
      starRating: null,
      videoDurationSec: null,
    };
  }
}

function toIsoDate(epochMs: number | null): string | null {
  if (typeof epochMs !== "number" || !Number.isFinite(epochMs)) {
    return null;
  }
  return new Date(epochMs).toISOString().slice(0, 10);
}

function buildDesktopAiMetadata(
  existingAiMetadata: string | null | undefined,
  extracted: ExtractedPhotoMetadata,
  extractedAt: string,
  filePath: string,
): string {
  const current = parseJson(existingAiMetadata);
  const hasEmbeddedText =
    !!extracted.embeddedTitle || !!extracted.embeddedDescription || !!extracted.embeddedLocation;
  const hasStar = typeof extracted.starRating === "number";
  const embeddedSource = hasEmbeddedText ? "mixed" : hasStar ? "file" : null;
  const isVideo = VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  const technicalSource = isVideo ? "file" : "xmp";
  const next = mergeMetadataV2(current, {
    schema_version: "2.0",
    metadata_version: METADATA_VERSION,
    file_data: {
      metadata_extracted_at: extractedAt,
      technical: {
        capture: {
          captured_at: extracted.photoTakenAt,
          photo_taken_precision: extracted.photoTakenPrecision,
          metadata_modified_at: extracted.metadataModifiedAt,
          camera_make: extracted.cameraMake,
          camera_model: extracted.cameraModel,
          lens_model: extracted.lensModel,
          focal_length_mm: extracted.focalLengthMm,
          f_number: extracted.fNumber,
          exposure_time: extracted.exposureTime,
          iso: extracted.iso,
        },
        ...(isVideo
          ? {
              video: {
                duration_sec: extracted.videoDurationSec,
              },
            }
          : {}),
      },
      exif_xmp: {
        source: embeddedSource ?? technicalSource,
        title: extracted.embeddedTitle,
        description: extracted.embeddedDescription,
        location_text: extracted.embeddedLocation,
        star_rating: extracted.starRating,
      },
    },
  });
  return JSON.stringify(normalizeMetadata(next));
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parsePhotoTakenPrecisionColumn(
  raw: string | null | undefined,
): DesktopPhotoTakenPrecision | null {
  if (raw === "year" || raw === "month" || raw === "day" || raw === "instant") {
    return raw;
  }
  return null;
}

function readEmbeddedStrings(ai: unknown): {
  title: string | null;
  description: string | null;
  locationText: string | null;
} {
  if (!ai || typeof ai !== "object") {
    return { title: null, description: null, locationText: null };
  }
  const fileData = (ai as { file_data?: Record<string, unknown> }).file_data;
  const emb = fileData?.exif_xmp;
  if (!emb || typeof emb !== "object") {
    return { title: null, description: null, locationText: null };
  }
  const embRecord = emb as Record<string, unknown>;
  const t =
    typeof embRecord.title === "string" && embRecord.title.trim() ? embRecord.title.trim() : null;
  const d =
    typeof embRecord.description === "string" && embRecord.description.trim()
      ? embRecord.description.trim()
      : null;
  const l =
    typeof embRecord.location_text === "string" && embRecord.location_text.trim()
      ? embRecord.location_text.trim()
      : null;
  return { title: t, description: d, locationText: l };
}
