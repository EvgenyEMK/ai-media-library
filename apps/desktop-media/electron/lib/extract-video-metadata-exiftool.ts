import { exiftool } from "exiftool-vendored";
import {
  inferMimeTypeFromPath,
  mergeStarRating,
  parseXmpDateString,
  rawTagToString,
} from "@emk/media-metadata-core";
import type { DesktopPhotoTakenPrecision } from "../../src/shared/ipc";

const READ_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

function parseDurationSec(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  const s = rawTagToString(raw);
  if (!s) {
    return null;
  }
  const t = s.trim();
  const hms = t.match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (hms) {
    const h = Number(hms[1]);
    const m = Number(hms[2]);
    const sec = Number(hms[3]);
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec)) {
      return h * 3600 + m * 60 + sec;
    }
  }
  const ms = t.match(/^(\d+):(\d{2})(?:\.\d+)?$/);
  if (ms) {
    const m = Number(ms[1]);
    const sec = Number(ms[2]);
    if (Number.isFinite(m) && Number.isFinite(sec)) {
      return m * 60 + sec;
    }
  }
  const withUnit = t.match(/^([\d.]+)\s*(?:s(?:ec(?:onds?)?)?)?$/i);
  if (withUnit) {
    const n = Number(withUnit[1]);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function firstDateFromTags(tags: Record<string, unknown>): {
  iso: string;
  precision: DesktopPhotoTakenPrecision;
} | null {
  const keys = [
    "DateTimeOriginal",
    "CreateDate",
    "MediaCreateDate",
    "TrackCreateDate",
    "CreationDate",
    "ModifyDate",
  ] as const;
  for (const key of keys) {
    const raw = tags[key];
    const str = rawTagToString(raw);
    if (!str) {
      continue;
    }
    const parsed = parseXmpDateString(str);
    if (parsed) {
      return { iso: parsed.canonical, precision: parsed.precision as DesktopPhotoTakenPrecision };
    }
  }
  return null;
}

function asNumberLoose(raw: unknown): number | null {
  const s = rawTagToString(raw);
  if (s) {
    const n = Number(s);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  return null;
}

export interface ExtractedVideoMetadata {
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
  lensModel: null;
  focalLengthMm: null;
  fNumber: null;
  exposureTime: null;
  iso: null;
  metadataModifiedAt: string | null;
  embeddedTitle: string | null;
  embeddedDescription: string | null;
  embeddedLocation: string | null;
  starRating: number | null;
  videoDurationSec: number | null;
}

export async function extractVideoMetadataWithExifTool(
  filePath: string,
  fallbackFileCreatedAt: string | null,
): Promise<ExtractedVideoMetadata> {
  const empty = (): ExtractedVideoMetadata => ({
    width: null,
    height: null,
    orientation: null,
    photoTakenAt: null,
    photoTakenPrecision: null,
    fileCreatedAt: fallbackFileCreatedAt,
    latitude: null,
    longitude: null,
    mimeType: inferMimeTypeFromPath(filePath),
    metadataError: null,
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
  });

  try {
    const tags = (await withTimeout(
      exiftool.read(filePath, { ignoreMinorErrors: true }),
      READ_TIMEOUT_MS,
      "ExifTool video metadata read",
    )) as Record<string, unknown>;

    const dateInfo = firstDateFromTags(tags);
    const mimeRaw = rawTagToString(tags.MIMEType) ?? rawTagToString(tags.MIMETypeRaw);
    const mimeType = mimeRaw?.trim() || inferMimeTypeFromPath(filePath);

    const width = asNumberLoose(tags.ImageWidth ?? tags.SourceImageWidth);
    const height = asNumberLoose(tags.ImageHeight ?? tags.SourceImageHeight);
    const orientation = asNumberLoose(tags.Orientation);

    const lat = asNumberLoose(tags.GPSLatitude);
    const lon = asNumberLoose(tags.GPSLongitude);

    const title = rawTagToString(tags.Title) ?? rawTagToString(tags["XMP:Title"]);
    const desc =
      rawTagToString(tags.Description) ??
      rawTagToString(tags["XMP:Description"]) ??
      rawTagToString(tags["QuickTime:Description"]);
    const loc =
      rawTagToString(tags.Location) ??
      rawTagToString(tags["XMP:Location"]) ??
      rawTagToString(tags["QuickTime:LocationName"]);

    const modifyRaw =
      rawTagToString(tags.ModifyDate) ??
      rawTagToString(tags["FileModifyDate"]) ??
      rawTagToString(tags.MetadataDate);
    const modifyParsed = modifyRaw ? parseXmpDateString(modifyRaw) : null;

    const starRating = mergeStarRating(
      tags["XMP:Rating"] ?? tags.Rating,
      tags["EXIF:Rating"],
      tags["EXIF:RatingPercent"] ?? tags.RatingPercent,
    );

    const duration = parseDurationSec(tags.Duration ?? tags["TrackDuration"] ?? tags.MediaDuration);

    return {
      width,
      height,
      orientation,
      photoTakenAt: dateInfo?.iso ?? null,
      photoTakenPrecision: dateInfo?.precision ?? null,
      fileCreatedAt: fallbackFileCreatedAt,
      latitude: lat,
      longitude: lon,
      mimeType,
      metadataError: null,
      cameraMake: rawTagToString(tags.Make),
      cameraModel: rawTagToString(tags.Model),
      lensModel: null,
      focalLengthMm: null,
      fNumber: null,
      exposureTime: null,
      iso: null,
      metadataModifiedAt: modifyParsed?.canonical ?? null,
      embeddedTitle: title,
      embeddedDescription: desc,
      embeddedLocation: loc,
      starRating,
      videoDurationSec: duration,
    };
  } catch (err) {
    const base = empty();
    base.metadataError = err instanceof Error ? err.message : "Failed to read video metadata";
    return base;
  }
}
