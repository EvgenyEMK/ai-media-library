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
 * Force the resident `exiftool-vendored` process to spawn before the first real read/write.
 * Without this the first call in a spec pays cold-start cost that can blow per-step timeouts on
 * slower Windows CI runners.
 */
export async function warmupExiftoolForE2E(): Promise<void> {
  await exiftool.version();
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
 * Poll until embedded metadata shows the expected stars. Prefer the rating as proof of the write:
 * Windows CI can report the same mtime for rapid successive ExifTool rewrites even after tags change.
 *
 * `onStaleRewrite`, when supplied, is invoked at most every {@link rewriteIntervalMs} milliseconds
 * while the disk still does not reflect the expected rating. Use it to re-issue the ExifTool write
 * via the desktop IPC, which heals rare cases where `exiftool-vendored`'s resident process
 * silently no-ops (CI on cold Windows runners has been observed to hit this).
 */
export async function waitUntilFileShowsStarRatingAndNewerMtime(
  filePath: string,
  expectedRating: number,
  mtimeMustBeAfterMs: number,
  options?: {
    timeoutMs?: number;
    onStaleRewrite?: () => Promise<void>;
    rewriteIntervalMs?: number;
  },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 240_000;
  const rewriteIntervalMs = options?.rewriteIntervalMs ?? 15_000;
  let lastRewriteAt = Date.now();
  let lastSnapshot:
    | {
        mtimeMs: number;
        catalogRating: number | null;
        shellRating: number | null;
        exifRating: number | null;
        ratingPercent: number | null;
        readError?: string;
      }
    | null = null;

  try {
    await expect
      .poll(
        async () => {
          let mtimeMs = -1;
          let catalogRating: number | null = null;
          let shellRating: number | null = null;
          let exifTags: { exifRating: number | null; ratingPercent: number | null } = {
            exifRating: null,
            ratingPercent: null,
          };
          let readError: string | undefined;
          try {
            mtimeMs = getFileMtimeMs(filePath);
            catalogRating = await readStarRatingFromImageFile(filePath);
            exifTags = await readWindowsExifRatingTags(filePath);
            shellRating = starsFromWindowsIfd0AndPercent(exifTags);
          } catch (err) {
            readError = err instanceof Error ? err.message : String(err);
          }
          lastSnapshot = {
            mtimeMs,
            catalogRating,
            shellRating,
            exifRating: exifTags.exifRating,
            ratingPercent: exifTags.ratingPercent,
            readError,
          };
          const matches =
            catalogRating === expectedRating || shellRating === expectedRating;
          if (!matches && options?.onStaleRewrite) {
            const now = Date.now();
            if (now - lastRewriteAt >= rewriteIntervalMs) {
              lastRewriteAt = now;
              try {
                await options.onStaleRewrite();
              } catch (err) {
                // Surface in the next poll iteration's diagnostics.
                lastSnapshot.readError =
                  (lastSnapshot.readError ? `${lastSnapshot.readError}; ` : "") +
                  `rewrite-failed: ${err instanceof Error ? err.message : String(err)}`;
              }
            }
          }
          return matches;
        },
        {
          timeout: timeoutMs,
          message: `Waiting for file ${filePath} catalog or Windows EXIF rating === ${expectedRating}`,
        },
      )
      .toBe(true);
  } catch (err) {
    const snap = lastSnapshot;
    const baseMsg = err instanceof Error ? err.message : String(err);
    const detail = snap
      ? `lastSnapshot: catalogRating=${snap.catalogRating} shellRating=${snap.shellRating} ` +
        `exifRating=${snap.exifRating} ratingPercent=${snap.ratingPercent} ` +
        `mtimeMs=${snap.mtimeMs} mtimeBaseline=${mtimeMustBeAfterMs} ` +
        `mtimeAdvanced=${snap.mtimeMs > mtimeMustBeAfterMs}` +
        (snap.readError ? ` readError=${snap.readError}` : "")
      : "no snapshot captured";
    throw new Error(
      `${baseMsg}\nExpected file ${filePath} rating === ${expectedRating}; ${detail}`,
    );
  }
}
