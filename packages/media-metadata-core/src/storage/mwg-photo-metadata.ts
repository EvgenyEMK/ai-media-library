/**
 * MWG-oriented helpers: XMP date grammar, star ratings (xmp:Rating + Windows EXIF),
 * and capture-date precedence (prefer XMP over EXIF when both exist).
 */

import type { PhotoTakenPrecision } from "../media-metadata";

export interface ParsedCaptureDate {
  canonical: string;
  precision: PhotoTakenPrecision;
}

/** XMP / EXIF datetime string → normalized stored value + precision for filtering/display. */
export function parseXmpDateString(source: string): ParsedCaptureDate | null {
  const t = source.trim();
  if (!t) {
    return null;
  }

  if (/^\d{4}$/.test(t)) {
    const y = parseInt(t, 10);
    if (y >= 1850 && y <= 2100) {
      return { canonical: t, precision: "year" };
    }
    return null;
  }

  const ym = t.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const y = parseInt(ym[1], 10);
    const m = parseInt(ym[2], 10);
    if (y >= 1850 && y <= 2100 && m >= 1 && m <= 12) {
      return { canonical: `${ym[1]}-${ym[2]}`, precision: "month" };
    }
    return null;
  }

  const dayOnly = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayOnly) {
    const y = parseInt(dayOnly[1], 10);
    const mo = parseInt(dayOnly[2], 10);
    const d = parseInt(dayOnly[3], 10);
    if (!isValidYmd(y, mo, d)) {
      return null;
    }
    return { canonical: `${dayOnly[1]}-${dayOnly[2]}-${dayOnly[3]}`, precision: "day" };
  }

  const normalized = t.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const withT = normalized.includes("T") ? normalized : normalized.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  const parsed = new Date(withT);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return { canonical: parsed.toISOString(), precision: "instant" };
}

export function parseExifCaptureDateTag(raw: unknown): ParsedCaptureDate | null {
  const source =
    typeof raw === "string"
      ? raw
      : typeof raw === "object" && raw !== null && "description" in raw
        ? String((raw as { description: unknown }).description)
        : null;

  if (!source?.trim()) {
    return null;
  }

  const normalized = source.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return { canonical: parsed.toISOString(), precision: "instant" };
}

/** Stable UTC instant for xmp:ModifyDate etc. when value is not a full instant. */
export function xmpDateToSortableInstant(parsed: ParsedCaptureDate): string {
  if (parsed.precision === "instant") {
    return parsed.canonical;
  }
  if (parsed.precision === "day") {
    return `${parsed.canonical}T00:00:00.000Z`;
  }
  if (parsed.precision === "month") {
    return `${parsed.canonical}-01T00:00:00.000Z`;
  }
  return `${parsed.canonical}-01-01T00:00:00.000Z`;
}

export function rawTagToString(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === "object" && "description" in raw) {
    const d = String((raw as { description: unknown }).description).trim();
    return d.length > 0 ? d : null;
  }
  if (typeof raw === "object" && "value" in raw) {
    return rawTagToString((raw as { value: unknown }).value);
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return rawTagToString(raw[0]);
  }
  return null;
}

/**
 * Merge star / rejection rating: XMP (`xmp:Rating` and aliases) over Windows EXIF
 * `Rating`, then `RatingPercent` (0–100).
 *
 * **Stored values (integer, `media_items.star_rating`):**
 * - **-1** — Rejected / pick (Adobe/Lightroom `xmp:Rating`; “below minimum useful rating”).
 * - **0** — Unrated or explicitly zero stars (no positive star selection).
 * - **1–5** — Star count (XMP/EXIF 1–5; some writers use higher integers and we normalize).
 *
 * **Windows Photo / Explorer:** `RatingPercent` uses **0** (unrated) then **1, 25, 50, 75, 99** for 1–5
 * stars (shell UI). IFD0 `Rating` is often stored as a short **0–5** star count; writers keep both in sync.
 * Values are normalized into the same 0–5 / -1 scale above.
 */
export function mergeStarRating(xmpRatingRaw: unknown, exifRatingRaw: unknown, ratingPercentRaw: unknown): number | null {
  const fromXmp = normalizeStarRatingValue(xmpRatingRaw, { allowRejected: true });
  if (fromXmp !== null) {
    return fromXmp;
  }
  const fromExif = normalizeStarRatingValue(exifRatingRaw, { allowRejected: false });
  if (fromExif !== null) {
    return fromExif;
  }
  return normalizePercentToStars(ratingPercentRaw);
}

function normalizeStarRatingValue(raw: unknown, opts: { allowRejected: boolean }): number | null {
  const n = readNumericTag(raw);
  if (n === null) {
    return null;
  }
  if (opts.allowRejected && Number.isInteger(n) && n === -1) {
    return -1;
  }
  if (Number.isInteger(n) && n >= 0 && n <= 5) {
    return n;
  }
  // IFD0 values like 25 / 50 / 75 / 99 (Windows writes); avoid legacy n/20 folding.
  if (Number.isInteger(n) && n > 5 && n <= 100) {
    return windowsRatingPercentOrIfd0ToStars(n);
  }
  return null;
}

/**
 * Map Windows `RatingPercent` (and IFD0 `Rating` when above 5) from 0–100 into 0–5 stars.
 * Canonical non-zero values are **1, 25, 50, 75, 99**; range buckets also cover legacy **20·k** writes.
 */
export function windowsRatingPercentOrIfd0ToStars(percentOrIfd0: number): number {
  if (!Number.isFinite(percentOrIfd0) || percentOrIfd0 <= 0) {
    return 0;
  }
  if (percentOrIfd0 <= 24) {
    return 1;
  }
  if (percentOrIfd0 <= 49) {
    return 2;
  }
  if (percentOrIfd0 <= 74) {
    return 3;
  }
  if (percentOrIfd0 <= 98) {
    return 4;
  }
  return 5;
}

function normalizePercentToStars(raw: unknown): number | null {
  const n = readNumericTag(raw);
  if (n === null || n < 0 || n > 100) {
    return null;
  }
  return windowsRatingPercentOrIfd0ToStars(n);
}

/**
 * EXIF `RatingPercent` for Windows Explorer (shell stars). IFD0 `Rating` stays 0–5 via {@link starsToExifIfd0Rating}.
 *
 * | Stars | Percent |
 * |-------|---------|
 * | 0 | 0 |
 * | 1 | 1 |
 * | 2 | 25 |
 * | 3 | 50 |
 * | 4 | 75 |
 * | 5 | 99 |
 */
/** Index = star count 1–5 → Windows IFD0 / RatingPercent value. */
const WINDOWS_STAR_TO_PERCENT = [1, 25, 50, 75, 99] as const;

export function starsToWindowsRatingPercent(stars: number): number {
  if (!Number.isFinite(stars) || stars <= 0) {
    return 0;
  }
  const s = Math.min(5, Math.max(1, Math.round(stars)));
  return WINDOWS_STAR_TO_PERCENT[s - 1] ?? 0;
}

/** EXIF IFD0 `Rating` short: literal 0–5 star count (pairs with Windows {@link starsToWindowsRatingPercent}). */
export function starsToExifIfd0Rating(stars: number): number {
  if (!Number.isFinite(stars) || stars <= 0) {
    return 0;
  }
  return Math.min(5, Math.max(1, Math.round(stars)));
}

function readNumericTag(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (raw && typeof raw === "object" && "value" in raw) {
    return readNumericTag((raw as { value: unknown }).value);
  }
  if (raw && typeof raw === "object" && "description" in raw) {
    const s = String((raw as { description: unknown }).description).trim();
    const parsed = Number(s);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1850 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }
  const dt = new Date(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d;
}
