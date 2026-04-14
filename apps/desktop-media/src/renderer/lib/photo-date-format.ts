import type { DesktopPhotoTakenPrecision } from "../../shared/ipc";

/**
 * Formats catalog date fields for list rows (photo taken preferred, then file created).
 * Supports partial capture dates when `photoTakenPrecision` is set (XMP / MWG).
 */
export function formatPhotoTakenListLabel(
  photoTakenAt: string | null,
  fileCreatedAt: string | null,
  photoTakenPrecision?: DesktopPhotoTakenPrecision | null,
): string {
  if (photoTakenAt) {
    const partial = formatPartialPhotoTaken(photoTakenAt, photoTakenPrecision ?? null);
    if (partial) {
      return partial;
    }
    const d = new Date(photoTakenAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString();
    }
  }

  if (fileCreatedAt) {
    const d = new Date(fileCreatedAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString();
    }
  }

  return "";
}

function formatPartialPhotoTaken(
  raw: string,
  precision: DesktopPhotoTakenPrecision | null,
): string | null {
  if (precision === "year" && /^\d{4}$/.test(raw)) {
    return raw;
  }
  if (precision === "month" && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-");
    const monthNum = parseInt(m, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return new Date(`${y}-${m}-01T12:00:00Z`).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
      });
    }
  }
  if (precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString();
  }
  return null;
}
