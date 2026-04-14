import fs from "node:fs";
import fsPromises from "node:fs/promises";
import ExifReader from "exifreader";
import { expect } from "@playwright/test";
import { exiftool } from "exiftool-vendored";
import {
  createExifReaderDomParser,
  inferMimeTypeFromPath,
  parseExifMetadataFromExpandedTags,
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

/**
 * Poll until the file’s `mtime` is strictly newer than `mtimeMustBeAfterMs` and
 * embedded metadata parses to the expected star rating (async background write from main).
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
        const rating = await readStarRatingFromImageFile(filePath);
        if (mtimeMs <= mtimeMustBeAfterMs) {
          return { ok: false as const, reason: "mtime", mtimeMs, rating };
        }
        if (rating !== expectedRating) {
          return { ok: false as const, reason: "rating", mtimeMs, rating };
        }
        return { ok: true as const, mtimeMs, rating };
      },
      {
        timeout: 120_000,
        message: `Expected file ${filePath} mtime > ${mtimeMustBeAfterMs} and embedded starRating === ${expectedRating}`,
      },
    )
    .toMatchObject({ ok: true, rating: expectedRating });
}
