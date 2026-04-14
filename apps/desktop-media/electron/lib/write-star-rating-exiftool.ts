import { exiftool } from "exiftool-vendored";
import {
  starsToExifIfd0Rating,
  starsToWindowsRatingPercent,
} from "@emk/media-metadata-core";

function exifToolWriteTimeoutMs(): number {
  const raw = process.env.EMK_EXIFTOOL_WRITE_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 90_000;
}

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

function xmpNowForExifTool(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * Writes MWG-aligned rating and timestamps via ExifTool (XMP + Windows-friendly EXIF).
 */
export async function writeStarRatingToImageFile(
  absolutePath: string,
  starRating: number,
): Promise<void> {
  if (!Number.isInteger(starRating) || starRating < 0 || starRating > 5) {
    throw new Error("writeStarRatingToImageFile: starRating must be 0–5.");
  }

  const now = xmpNowForExifTool();
  const exifRating = starsToExifIfd0Rating(starRating);
  const pct = starsToWindowsRatingPercent(starRating);

  const timeoutMs = exifToolWriteTimeoutMs();
  await withTimeout(
    exiftool.write(
      absolutePath,
      {
        "XMP:Rating": starRating,
        "XMP:ModifyDate": now,
        "XMP:MetadataDate": now,
        "EXIF:Rating": exifRating,
        "EXIF:RatingPercent": pct,
      } as Record<string, string | number>,
      {
        writeArgs: ["-overwrite_original"],
        useMWG: true,
        ignoreMinorErrors: true,
      },
    ),
    timeoutMs,
    "ExifTool star rating write",
  );
}
