import { formatDateByPreference, type DateDisplayFormat } from "@emk/shared-contracts";
import type { DesktopPhotoTakenPrecision } from "../../shared/ipc";

/**
 * Formats catalog date fields for list rows (photo taken preferred, then file created).
 * Supports partial capture dates when `photoTakenPrecision` is set (XMP / MWG).
 */
export function formatPhotoTakenListLabel(
  photoTakenAt: string | null,
  fileCreatedAt: string | null,
  photoTakenPrecision?: DesktopPhotoTakenPrecision | null,
  dateFormat?: DateDisplayFormat,
): string {
  if (photoTakenAt) {
    const partial = formatPartialPhotoTaken(photoTakenAt, photoTakenPrecision ?? null, dateFormat);
    if (partial) {
      return partial;
    }
    if (dateFormat) {
      const formattedTaken = formatDateByPreference(photoTakenAt, dateFormat);
      if (formattedTaken) {
        return formattedTaken;
      }
    } else {
      const parsedTaken = new Date(photoTakenAt);
      if (!Number.isNaN(parsedTaken.getTime())) {
        return parsedTaken.toLocaleDateString();
      }
    }
  }

  if (fileCreatedAt) {
    if (dateFormat) {
      const formattedCreated = formatDateByPreference(fileCreatedAt, dateFormat);
      if (formattedCreated) {
        return formattedCreated;
      }
    } else {
      const parsedCreated = new Date(fileCreatedAt);
      if (!Number.isNaN(parsedCreated.getTime())) {
        return parsedCreated.toLocaleDateString();
      }
    }
  }

  return "";
}

function formatPartialPhotoTaken(
  raw: string,
  precision: DesktopPhotoTakenPrecision | null,
  dateFormat?: DateDisplayFormat,
): string | null {
  if (precision === "year" && /^\d{4}$/.test(raw)) {
    return raw;
  }
  if (precision === "month" && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-");
    const monthNum = parseInt(m, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      if (!dateFormat) {
        return new Date(`${y}-${m}-01T12:00:00Z`).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
        });
      }
      if (dateFormat === "YYYY-MM-DD") return `${y}-${m}`;
      if (dateFormat === "MM/DD/YYYY") return `${m}/${y}`;
      return `${m}.${y}`;
    }
  }
  if (precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (dateFormat) {
      const formatted = formatDateByPreference(`${raw}T12:00:00Z`, dateFormat);
      return formatted || raw;
    }
    const parsedDay = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(parsedDay.getTime()) ? raw : parsedDay.toLocaleDateString();
  }
  return null;
}
