import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";

/** Sort key: pinned first, then label (case-insensitive). */
export function comparePersonTagRows(
  a: Pick<DesktopPersonTagWithFaceCount, "pinned" | "label">,
  b: Pick<DesktopPersonTagWithFaceCount, "pinned" | "label">,
): number {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}
