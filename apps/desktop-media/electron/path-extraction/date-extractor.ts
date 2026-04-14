import type { PathDateExtraction, PathExtractionSource } from "./types";

interface ExtractedDate {
  start: string;
  end: string | null;
  precision: "year" | "month" | "day";
  rawMatch: string;
}

const MIN_YEAR = 1800;
const MAX_YEAR = 2100;

function isValidYear(y: number): boolean {
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

function isValidMonth(m: number): boolean {
  return m >= 1 && m <= 12;
}

function isValidDay(d: number): boolean {
  return d >= 1 && d <= 31;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Expand a short year relative to a base century.
 * E.g. base=1982, short=91 -> 1991; base=2000, short=05 -> 2005.
 */
function expandShortYear(base: number, short: number): number {
  const century = Math.floor(base / 100) * 100;
  const candidate = century + short;
  if (candidate < base) {
    return century + 100 + short;
  }
  return candidate;
}

/**
 * Try extracting a date or date range from a single text segment (filename or folder name).
 * Returns the first match found in priority order.
 */
export function extractDateFromSegment(text: string): ExtractedDate | null {
  // --- Date ranges (must be checked before single dates) ---

  // YYYY-MM-DD -- YYYY-MM-DD (with flexible separators: spaces, dashes)
  const fullRangeRe =
    /(\d{4})-(\d{2})-(\d{2})\s*-{1,2}\s*(\d{4})-(\d{2})-(\d{2})/;
  const fullRangeMatch = text.match(fullRangeRe);
  if (fullRangeMatch) {
    const [, y1, m1, d1, y2, m2, d2] = fullRangeMatch;
    const yn1 = parseInt(y1, 10), mn1 = parseInt(m1, 10), dn1 = parseInt(d1, 10);
    const yn2 = parseInt(y2, 10), mn2 = parseInt(m2, 10), dn2 = parseInt(d2, 10);
    if (
      isValidYear(yn1) && isValidMonth(mn1) && isValidDay(dn1) &&
      isValidYear(yn2) && isValidMonth(mn2) && isValidDay(dn2)
    ) {
      return {
        start: `${y1}-${m1}-${d1}`,
        end: `${y2}-${m2}-${d2}`,
        precision: "day",
        rawMatch: fullRangeMatch[0],
      };
    }
  }

  // YYYY-MM-DD -- MM-DD
  const crossMonthRe =
    /(\d{4})-(\d{2})-(\d{2})\s*-{1,2}\s*(\d{2})-(\d{2})/;
  const crossMonthMatch = text.match(crossMonthRe);
  if (crossMonthMatch && !fullRangeMatch) {
    const [, y, m1, d1, m2, d2] = crossMonthMatch;
    const yn = parseInt(y, 10), mn1 = parseInt(m1, 10), dn1 = parseInt(d1, 10);
    const mn2 = parseInt(m2, 10), dn2 = parseInt(d2, 10);
    if (
      isValidYear(yn) &&
      isValidMonth(mn1) && isValidDay(dn1) &&
      isValidMonth(mn2) && isValidDay(dn2)
    ) {
      return {
        start: `${y}-${m1}-${d1}`,
        end: `${y}-${pad2(mn2)}-${pad2(dn2)}`,
        precision: "day",
        rawMatch: crossMonthMatch[0],
      };
    }
  }

  // YYYY-MM-DD -- DD (day span within same month)
  const daySpanRe = /(\d{4})-(\d{2})-(\d{2})\s*-{1,2}\s*(\d{1,2})(?!\d)/;
  const daySpanMatch = text.match(daySpanRe);
  if (daySpanMatch && !fullRangeMatch && !crossMonthMatch) {
    const [, y, m, d1, d2] = daySpanMatch;
    const yn = parseInt(y, 10), mn = parseInt(m, 10);
    const dn1 = parseInt(d1, 10), dn2 = parseInt(d2, 10);
    if (isValidYear(yn) && isValidMonth(mn) && isValidDay(dn1) && isValidDay(dn2)) {
      return {
        start: `${y}-${m}-${d1}`,
        end: `${y}-${m}-${pad2(dn2)}`,
        precision: "day",
        rawMatch: daySpanMatch[0],
      };
    }
  }

  // YYYY-YYYY or YYYY - YYYY (year range, both 4 digits)
  const yearRangeFullRe = /\b(\d{4})\s*-{1,2}\s*(\d{4})\b/;
  const yearRangeFullMatch = text.match(yearRangeFullRe);
  if (yearRangeFullMatch) {
    const y1 = parseInt(yearRangeFullMatch[1], 10);
    const y2 = parseInt(yearRangeFullMatch[2], 10);
    if (isValidYear(y1) && isValidYear(y2) && y2 > y1) {
      return {
        start: yearRangeFullMatch[1],
        end: yearRangeFullMatch[2],
        precision: "year",
        rawMatch: yearRangeFullMatch[0],
      };
    }
  }

  // YYYY--YY or YYYY -- YY (short year range)
  const yearRangeShortRe = /\b(\d{4})\s*-{2}\s*(\d{2})\b/;
  const yearRangeShortMatch = text.match(yearRangeShortRe);
  if (yearRangeShortMatch) {
    const y1 = parseInt(yearRangeShortMatch[1], 10);
    const shortY2 = parseInt(yearRangeShortMatch[2], 10);
    if (isValidYear(y1) && shortY2 >= 0 && shortY2 <= 99) {
      const y2 = expandShortYear(y1, shortY2);
      if (isValidYear(y2) && y2 > y1) {
        return {
          start: yearRangeShortMatch[1],
          end: y2.toString(),
          precision: "year",
          rawMatch: yearRangeShortMatch[0],
        };
      }
    }
  }

  // --- Single dates ---

  // YYYY-MM-DD at any position
  const isoDateRe = /\b(\d{4})-(\d{2})-(\d{2})\b/;
  const isoDateMatch = text.match(isoDateRe);
  if (isoDateMatch) {
    const yn = parseInt(isoDateMatch[1], 10);
    const mn = parseInt(isoDateMatch[2], 10);
    const dn = parseInt(isoDateMatch[3], 10);
    if (isValidYear(yn) && isValidMonth(mn) && isValidDay(dn)) {
      return {
        start: `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`,
        end: null,
        precision: "day",
        rawMatch: isoDateMatch[0],
      };
    }
  }

  // YYYYMMDD_HHMMSS or YYYYMMDD (8 consecutive digits, optionally after IMG_ / DSC_ etc.)
  const compactDateRe = /(?:^|[_\-\s])(\d{4})(\d{2})(\d{2})(?:[_\s]|$)/;
  const compactDateMatch = text.match(compactDateRe);
  if (compactDateMatch) {
    const yn = parseInt(compactDateMatch[1], 10);
    const mn = parseInt(compactDateMatch[2], 10);
    const dn = parseInt(compactDateMatch[3], 10);
    if (isValidYear(yn) && isValidMonth(mn) && isValidDay(dn)) {
      return {
        start: `${compactDateMatch[1]}-${pad2(mn)}-${pad2(dn)}`,
        end: null,
        precision: "day",
        rawMatch: compactDateMatch[0].trim(),
      };
    }
  }

  // YYYY-MM (not followed by -DD, i.e. not part of YYYY-MM-DD already matched)
  const yearMonthRe = /\b(\d{4})-(\d{2})(?!-\d)/;
  const yearMonthMatch = text.match(yearMonthRe);
  if (yearMonthMatch) {
    const yn = parseInt(yearMonthMatch[1], 10);
    const mn = parseInt(yearMonthMatch[2], 10);
    if (isValidYear(yn) && isValidMonth(mn)) {
      return {
        start: `${yearMonthMatch[1]}-${yearMonthMatch[2]}`,
        end: null,
        precision: "month",
        rawMatch: yearMonthMatch[0],
      };
    }
  }

  // Standalone YYYY (word boundary, not part of a longer number sequence)
  const yearOnlyRe = /(?:^|\s|[_\-(])(\d{4})(?:\s|[_\-),.]|$)/;
  const yearOnlyMatch = text.match(yearOnlyRe);
  if (yearOnlyMatch) {
    const yn = parseInt(yearOnlyMatch[1], 10);
    if (isValidYear(yn)) {
      return {
        start: yearOnlyMatch[1],
        end: null,
        precision: "year",
        rawMatch: yearOnlyMatch[1],
      };
    }
  }

  return null;
}

/**
 * Extract a date from the full file path, considering both filename and folder hierarchy.
 * Filename date takes precedence. If no filename date, walks up folder segments.
 */
export function extractDateFromPath(filePath: string): PathDateExtraction | null {
  const normalized = filePath.replace(/\\/g, "/");
  const allSegments = normalized
    .split("/")
    .filter((s) => s.length > 0 && !s.match(/^[A-Za-z]:$/));
  const filenameSegment = allSegments[allSegments.length - 1] ?? "";
  const filenameWithoutExt = filenameSegment.replace(/\.[^/.]+$/, "");
  const dirSegments = allSegments.slice(0, -1);

  const filenameDate = extractDateFromSegment(filenameWithoutExt);
  if (filenameDate) {
    const folderDate = findDateInFolderSegments(dirSegments);
    const source: PathExtractionSource =
      folderDate ? "script_filename+folder" : "script_filename";

    return {
      start: filenameDate.start,
      end: filenameDate.end,
      precision: filenameDate.precision,
      source,
      raw_match: filenameDate.rawMatch,
      from_folder_depth: 0,
    };
  }

  // No filename date -- try folder segments (closest first)
  for (let i = dirSegments.length - 1; i >= 0; i--) {
    const folderDate = extractDateFromSegment(dirSegments[i]);
    if (folderDate) {
      const depth = dirSegments.length - i;
      return {
        start: folderDate.start,
        end: folderDate.end,
        precision: folderDate.precision,
        source: "script_folder",
        raw_match: folderDate.rawMatch,
        from_folder_depth: depth,
      };
    }
  }

  return null;
}

function findDateInFolderSegments(
  segments: string[],
): ExtractedDate | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const d = extractDateFromSegment(segments[i]);
    if (d) return d;
  }
  return null;
}
