import fs from "node:fs";
import fsPromises from "node:fs/promises";
import ExifReader from "exifreader";
import { expect } from "@playwright/test";
import { exiftool } from "exiftool-vendored";
import {
  createExifReaderDomParser,
  inferMimeTypeFromPath,
  parseExifMetadataFromExpandedTags,
  windowsRatingPercentOrIfd0ToStars,
} from "@emk/media-metadata-core";

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * IFD0 `Rating` + `RatingPercent` as ExifTool reports them (Windows shell scale).
 * Call {@link shutdownExiftoolForE2E} in `test.afterAll` when using this in a spec file.
 */
export async function readWindowsExifRatingTags(absolutePath: string): Promise<{
  exifRating: number | null;
  ratingPercent: number | null;
}> {
  const tags = (await exiftool.read(absolutePath, { ignoreMinorErrors: true })) as Record<string, unknown>;
  const pick = (...keys: string[]): number | null => {
    for (const k of keys) {
      const n = asFiniteNumber(tags[k]);
      if (n !== null) {
        return n;
      }
    }
    return null;
  };
  return {
    exifRating: pick("Rating", "EXIF:Rating"),
    ratingPercent: pick("RatingPercent", "EXIF:RatingPercent"),
  };
}

export async function shutdownExiftoolForE2E(): Promise<void> {
  await exiftool.end();
}

/**
 * Read star rating from embedded metadata using the same ExifReader + parser path as
 * the desktop catalog, so E2E asserts match what the app considers “on disk”.
 */
export async function readStarRatingFromImageFile(absolutePath: string): Promise<number | null> {
  const buffer = await fsPromises.readFile(absolutePath);
  const tags = await ExifReader.load(buffer, {
    expanded: true,
    domParser: createExifReaderDomParser(),
  });
  const parsed = parseExifMetadataFromExpandedTags(tags, {
    fallbackMimeType: inferMimeTypeFromPath(absolutePath),
  });
  return parsed.starRating;
}

export function getFileMtimeMs(absolutePath: string): number {
  return fs.statSync(absolutePath).mtimeMs;
}

function starsFromWindowsIfd0AndPercent(w: {
  exifRating: number | null;
  ratingPercent: number | null;
}): number | null {
  if (w.exifRating !== null && w.exifRating >= 1 && w.exifRating <= 5) {
    return w.exifRating;
  }
  if (w.ratingPercent !== null) {
    return windowsRatingPercentOrIfd0ToStars(w.ratingPercent);
  }
  return null;
}

/**
 * Poll until the file’s `mtime` is strictly newer than `mtimeMustBeAfterMs` and
 * embedded metadata shows the expected stars. Accepts either the catalog parser (ExifReader,
 * XMP-first merge) **or** Windows IFD0 `Rating` / `RatingPercent` — ExifTool can briefly leave
 * XMP out of sync with IFD0 on successive writes; the app’s merge prefers XMP, but disk may
 * already reflect the new rating in EXIF.
 */
export async function waitUntilFileShowsStarRatingAndNewerMtime(
  filePath: string,
  expectedRating: number,
  mtimeMustBeAfterMs: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const mtimeMs = getFileMtimeMs(filePath);
        if (mtimeMs <= mtimeMustBeAfterMs) {
          return { ok: false as const, reason: "mtime" as const, mtimeMs };
        }
        const catalogRating = await readStarRatingFromImageFile(filePath);
        const exifTags = await readWindowsExifRatingTags(filePath);
        const shellRating = starsFromWindowsIfd0AndPercent(exifTags);
        const matches =
          catalogRating === expectedRating || shellRating === expectedRating;
        if (!matches) {
          return {
            ok: false as const,
            reason: "rating" as const,
            mtimeMs,
            catalogRating,
            shellRating,
          };
        }
        return { ok: true as const, mtimeMs, catalogRating, shellRating };
      },
      {
        timeout: 120_000,
        message: `Expected file ${filePath} mtime > ${mtimeMustBeAfterMs} and catalog or Windows EXIF rating === ${expectedRating}`,
      },
    )
    .toMatchObject({ ok: true });
}
