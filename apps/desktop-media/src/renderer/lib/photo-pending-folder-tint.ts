import type { PhotoPendingFolderIconTint } from "../../shared/ipc";

/** Lucide `Square` color (Tailwind class) for sidebar folder icon. */
export function photoPendingTintToSquareClass(tint: PhotoPendingFolderIconTint): string {
  switch (tint) {
    case "red":
      return "text-red-400";
    case "amber":
      return "text-amber-400";
    case "green":
      return "text-[hsl(var(--success))]";
    default:
      return "text-amber-400";
  }
}

/** Mini-card border when image analysis is the only incomplete pipeline (matches sidebar tint). */
export function photoPendingTintToBorderClass(tint: PhotoPendingFolderIconTint): string {
  switch (tint) {
    case "red":
      return "border-destructive";
    case "amber":
      return "border-amber-400";
    case "green":
      return "border-[hsl(var(--success))]";
    default:
      return "border-amber-400";
  }
}
