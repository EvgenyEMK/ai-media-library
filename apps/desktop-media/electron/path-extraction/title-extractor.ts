import path from "node:path";

/**
 * Camera/scanner file identifier patterns.
 * Each is tested against the cleaned string. The first capture group
 * (or full match) is removed.
 */
const LEADING_ID_PATTERNS: RegExp[] = [
  /^(?:IMG|DSC[NF]?|DSCN|IMGP|SAM|MVI|MOV|VID|WP|PANO)[-_]?\d+(?:[-_]\d+)*/i,
  /^scan\s*\d*/i,
  /^(?:image|photo|pic|picture|img)\s*\d*/i,
  /^P\d{4,}/i,
];

const TRAILING_ID_PATTERNS: RegExp[] = [
  /\s+scan\s*\d+$/i,
  /\s+(?:IMG|DSC[NF]?|DSCN)[-_]?\d+$/i,
];

/** Trailing isolated digits (e.g. " 1" at end of "Ботанический сад 1"). */
const TRAILING_LONE_DIGITS_RE = /[\s_\-]+\d{1,4}$/;

/**
 * Extract a clean, human-readable display title from a filename.
 * Strips file extension, camera/scanner identifiers at start and end,
 * and trailing isolated digits or punctuation artifacts.
 *
 * Returns null if the result is empty, purely numeric, or a
 * generic identifier like "scan".
 */
export function extractDisplayTitle(filename: string): string | null {
  let text = path.parse(filename).name;

  for (const pattern of LEADING_ID_PATTERNS) {
    text = text.replace(pattern, "");
  }

  for (const pattern of TRAILING_ID_PATTERNS) {
    text = text.replace(pattern, "");
  }

  text = text.replace(TRAILING_LONE_DIGITS_RE, "");

  // Clean edge punctuation / whitespace
  text = text.replace(/^[\s,.\-_]+/, "").replace(/[\s,.\-_]+$/, "");

  if (!text || /^\d+$/.test(text) || /^scan$/i.test(text)) {
    return null;
  }

  return text;
}

/**
 * True when the file name is effectively just a camera/scanner identifier
 * (e.g. IMG_1234, DSC_0001, scan0002), with no meaningful title payload.
 */
export function isCameraPrefixOnlyFilename(filename: string): boolean {
  const name = path.parse(filename).name.trim();
  if (!name) {
    return false;
  }
  const hasKnownPrefix = LEADING_ID_PATTERNS.some((pattern) => pattern.test(name));
  if (!hasKnownPrefix) {
    return false;
  }
  return extractDisplayTitle(filename) === null;
}
