import type { PhotoTakenPrecision } from "../media-metadata";
import {
  mergeStarRating,
  parseExifCaptureDateTag,
  parseXmpDateString,
  rawTagToString,
  xmpDateToSortableInstant,
} from "./mwg-photo-metadata";

export type { PhotoTakenPrecision } from "../media-metadata";

export interface ParsedExifMetadata {
  width: number | null;
  height: number | null;
  orientation: number | null;
  photoTakenAt: string | null;
  photoTakenPrecision: PhotoTakenPrecision | null;
  metadataModifiedAt: string | null;
  embeddedTitle: string | null;
  embeddedDescription: string | null;
  embeddedLocation: string | null;
  starRating: number | null;
  latitude: number | null;
  longitude: number | null;
  mimeType: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLengthMm: number | null;
  fNumber: number | null;
  exposureTime: string | null;
  iso: number | null;
}

export function extractDateFromFilename(filename: string): string | undefined {
  const datePattern = /^(\d{4}(?:-\d{2}(?:-\d{2})?)?)(?:[-_\s]|$)/;
  const match = filename.match(datePattern);

  if (!match) {
    return undefined;
  }

  const dateStr = match[1];

  if (dateStr.length === 4) {
    const year = parseInt(dateStr, 10);
    if (year >= 1900 && year <= 2100) {
      return dateStr;
    }
    return undefined;
  }

  if (dateStr.length === 7) {
    const [year, month] = dateStr.split("-");
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    if (yearNum >= 1900 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12) {
      return dateStr;
    }
    return undefined;
  }

  if (dateStr.length === 10) {
    const [year, month, day] = dateStr.split("-");
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (
      yearNum >= 1900 &&
      yearNum <= 2100 &&
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31
    ) {
      const date = new Date(`${year}-${month}-${day}`);
      if (
        date.getFullYear() === yearNum &&
        date.getMonth() + 1 === monthNum &&
        date.getDate() === dayNum
      ) {
        return `${year}-${month}`;
      }
    }
  }

  return undefined;
}

/**
 * Parses ExifReader `expanded` output: EXIF/GPS/file dimensions plus XMP/IPTC (MWG: prefer XMP capture dates over EXIF when present).
 */
export function parseExifMetadataFromExpandedTags(
  tags: unknown,
  options?: {
    fallbackMimeType?: string | null;
  },
): ParsedExifMetadata {
  const imageWidthTag =
    getExpandedTagValue(tags, "file", "ImageWidth") ??
    getExpandedTagValue(tags, "file", "Image Width") ??
    getExpandedTagValue(tags, "exif", "PixelXDimension") ??
    getExpandedTagValue(tags, "ifd0", "ImageWidth") ??
    getExpandedTagValue(tags, "ifd0", "Image Width");
  const imageHeightTag =
    getExpandedTagValue(tags, "file", "ImageHeight") ??
    getExpandedTagValue(tags, "file", "Image Height") ??
    getExpandedTagValue(tags, "exif", "PixelYDimension") ??
    getExpandedTagValue(tags, "ifd0", "ImageLength") ??
    getExpandedTagValue(tags, "ifd0", "Image Length");
  const orientationTag =
    getExpandedTagValue(tags, "ifd0", "Orientation") ??
    getExpandedTagValue(tags, "image", "Orientation");
  const dateTimeOriginalTag =
    getExpandedTagValue(tags, "exif", "DateTimeOriginal") ??
    getExpandedTagValue(tags, "exif", "DateTime Digitized") ??
    getExpandedTagValue(tags, "ifd0", "ModifyDate");
  const latitudeTag = getExpandedTagValue(tags, "gps", "Latitude");
  const longitudeTag = getExpandedTagValue(tags, "gps", "Longitude");
  const mimeTag = getExpandedTagValue(tags, "file", "MIMEType");
  const cameraMakeTag =
    getExpandedTagValue(tags, "ifd0", "Make") ??
    getExpandedTagValue(tags, "image", "Make");
  const cameraModelTag =
    getExpandedTagValue(tags, "ifd0", "Model") ??
    getExpandedTagValue(tags, "image", "Model");
  const lensModelTag =
    getExpandedTagValue(tags, "exif", "LensModel") ??
    getExpandedTagValue(tags, "exif", "Lens Model");
  const focalLengthTag = getExpandedTagValue(tags, "exif", "FocalLength");
  const fNumberTag =
    getExpandedTagValue(tags, "exif", "FNumber") ??
    getExpandedTagValue(tags, "exif", "F Number");
  const exposureTimeTag =
    getExpandedTagValue(tags, "exif", "ExposureTime") ??
    getExpandedTagValue(tags, "exif", "Exposure Time");
  const isoTag =
    getExpandedTagValue(tags, "exif", "ISOSpeedRatings") ??
    getExpandedTagValue(tags, "exif", "ISO");

  const exifCapture = parseExifCaptureDateTag(dateTimeOriginalTag);

  const xmpDateCreated =
    firstParsedXmpDate(
      getExpandedTagValue(tags, "xmp", "photoshop:DateCreated"),
      getExpandedTagValue(tags, "xmp", "xmp:CreateDate"),
    ) ?? null;

  let photoTakenAt: string | null = null;
  let photoTakenPrecision: PhotoTakenPrecision | null = null;
  if (xmpDateCreated) {
    photoTakenAt = xmpDateCreated.canonical;
    photoTakenPrecision = xmpDateCreated.precision;
  } else if (exifCapture) {
    photoTakenAt = exifCapture.canonical;
    photoTakenPrecision = exifCapture.precision;
  }

  const modifyRaw =
    rawTagToString(getExpandedTagValue(tags, "xmp", "xmp:ModifyDate")) ??
    rawTagToString(getExpandedTagValue(tags, "xmp", "ModifyDate"));
  const modifyParsed = modifyRaw ? parseXmpDateString(modifyRaw) : null;
  const metadataModifiedAt = modifyParsed ? xmpDateToSortableInstant(modifyParsed) : null;

  const xmpTitle = rawTagToString(getExpandedTagValue(tags, "xmp", "dc:title"));
  const xmpDescription = rawTagToString(getExpandedTagValue(tags, "xmp", "dc:description"));
  const iptcHeadline = asString(getExpandedTagValue(tags, "iptc", "Headline"));
  const iptcCaption = asString(getExpandedTagValue(tags, "iptc", "Caption/Abstract"));

  const embeddedTitle = xmpTitle ?? iptcHeadline;
  const embeddedDescription = xmpDescription ?? iptcCaption;

  const embeddedLocation =
    rawTagToString(getExpandedTagValue(tags, "xmp", "Iptc4xmpCore:Location")) ??
    rawTagToString(getExpandedTagValue(tags, "xmp", "Iptc4xmpExt:LocationShown")) ??
    combineLocationParts(
      rawTagToString(getExpandedTagValue(tags, "xmp", "photoshop:City")),
      rawTagToString(getExpandedTagValue(tags, "xmp", "photoshop:State")),
      rawTagToString(getExpandedTagValue(tags, "xmp", "photoshop:Country")),
    ) ??
    asString(getExpandedTagValue(tags, "iptc", "City")) ??
    null;

  const ratingTag =
    getExpandedTagValue(tags, "ifd0", "Rating") ?? getExpandedTagValue(tags, "image", "Rating");
  const ratingPercentTag =
    getExpandedTagValue(tags, "ifd0", "RatingPercent") ??
    getExpandedTagValue(tags, "image", "RatingPercent");

  const xmpRatingRaw =
    getExpandedTagValue(tags, "xmp", "xmp:Rating") ??
    getExpandedTagValue(tags, "xmp", "Rating") ??
    getExpandedTagValue(tags, "xmp", "MicrosoftPhoto:Rating") ??
    getExpandedTagValue(tags, "xmp", "Last Rating");

  const starRating = mergeStarRating(xmpRatingRaw, ratingTag, ratingPercentTag);

  return {
    width: asNumber(imageWidthTag),
    height: asNumber(imageHeightTag),
    orientation: asNumber(orientationTag),
    photoTakenAt,
    photoTakenPrecision,
    metadataModifiedAt,
    embeddedTitle,
    embeddedDescription,
    embeddedLocation,
    starRating,
    latitude: asNumber(latitudeTag),
    longitude: asNumber(longitudeTag),
    mimeType: parseMimeType(mimeTag) ?? options?.fallbackMimeType ?? null,
    cameraMake: asString(cameraMakeTag),
    cameraModel: asString(cameraModelTag),
    lensModel: asString(lensModelTag),
    focalLengthMm: asExifNumber(focalLengthTag),
    fNumber: asExifNumber(fNumberTag),
    exposureTime: asString(exposureTimeTag),
    iso: asExifNumber(isoTag),
  };
}

export function inferMimeTypeFromPath(filePath: string): string | null {
  const extensionMatch = filePath.toLowerCase().match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1] ?? "";
  const byExtension: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
  };
  return byExtension[extension] ?? null;
}

function firstParsedXmpDate(...raws: unknown[]): ReturnType<typeof parseXmpDateString> | null {
  for (const raw of raws) {
    const s = rawTagToString(raw);
    if (!s) {
      continue;
    }
    const parsed = parseXmpDateString(s);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function combineLocationParts(city: string | null, state: string | null, country: string | null): string | null {
  const parts = [city, state, country].filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  if (parts.length === 0) {
    return null;
  }
  return parts.join(", ");
}

function getExpandedTagValue(
  tags: unknown,
  groupName: string,
  key: string,
): unknown {
  if (!tags || typeof tags !== "object") {
    return undefined;
  }
  const groups = tags as Record<string, unknown>;
  const group = groups[groupName];
  if (!group || typeof group !== "object") {
    return undefined;
  }
  const record = group as Record<string, unknown>;
  return record[key];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof (value as { value: unknown }).value === "number"
  ) {
    const nested = (value as { value: number }).value;
    return Number.isFinite(nested) ? nested : null;
  }

  return null;
}

function asExifNumber(value: unknown): number | null {
  const direct = asNumber(value);
  if (typeof direct === "number") {
    return direct;
  }

  if (value && typeof value === "object" && "description" in value) {
    const description = String((value as { description: unknown }).description).trim();
    if (!description) {
      return null;
    }

    const fraction = description.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (fraction) {
      const numerator = Number(fraction[1]);
      const denominator = Number(fraction[2]);
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }

    const numeric = description.match(/-?\d+(?:\.\d+)?/);
    if (numeric) {
      const parsed = Number(numeric[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object" && "description" in value) {
    const description = String((value as { description: unknown }).description).trim();
    return description.length > 0 ? description : null;
  }

  return null;
}

function parseMimeType(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim().toLowerCase();
  }
  return null;
}
