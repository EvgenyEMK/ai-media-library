import type {
  PathDateExtraction,
  ResolvedEventDate,
  EventDateSource,
  EventDatePrecision,
} from "./types";

interface ExifDateInfo {
  photoTakenAt: string | null;
  photoTakenPrecision: "year" | "month" | "day" | "instant" | null;
}

interface FileTimeInfo {
  fileCreatedAt: string | null;
}

/**
 * Extract the year from a partial-ISO date string.
 * Accepts "YYYY", "YYYY-MM", or "YYYY-MM-DD".
 */
function yearOf(dateStr: string): number | null {
  const m = dateStr.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Resolve the best "event date" from all available sources.
 *
 * Priority:
 * 1. If EXIF and path date both exist and path year < EXIF year
 *    -> use path date (scanned old photo scenario)
 * 2. If EXIF and path date both exist otherwise -> use EXIF (more precise)
 * 3. EXIF only -> use EXIF
 * 4. Path only -> use path
 * 5. File mtime -> last resort
 */
export function resolveEventDate(
  exif: ExifDateInfo,
  pathDate: PathDateExtraction | null,
  fileTime: FileTimeInfo,
): ResolvedEventDate | null {
  const hasExif = !!exif.photoTakenAt;
  const hasPath = !!pathDate?.start;

  if (hasExif && hasPath) {
    const exifYear = yearOf(exif.photoTakenAt!);
    const pathYear = yearOf(pathDate!.start!);

    if (exifYear !== null && pathYear !== null && pathYear < exifYear) {
      return fromPathDate(pathDate!);
    }

    return fromExif(exif);
  }

  if (hasExif) {
    return fromExif(exif);
  }

  if (hasPath) {
    return fromPathDate(pathDate!);
  }

  if (fileTime.fileCreatedAt) {
    return {
      start: fileTime.fileCreatedAt,
      end: null,
      precision: "day",
      source: "file_mtime",
    };
  }

  return null;
}

function fromExif(exif: ExifDateInfo): ResolvedEventDate {
  const precision: EventDatePrecision = exif.photoTakenPrecision ?? "instant";
  const source: EventDateSource =
    precision === "instant" || precision === "day" ? "exif" : "xmp";
  return {
    start: exif.photoTakenAt!,
    end: null,
    precision,
    source,
  };
}

function fromPathDate(pd: PathDateExtraction): ResolvedEventDate {
  const source: EventDateSource =
    pd.source === "llm_path" ? "path_llm" : "path_script";
  return {
    start: pd.start!,
    end: pd.end,
    precision: pd.precision,
    source,
  };
}
