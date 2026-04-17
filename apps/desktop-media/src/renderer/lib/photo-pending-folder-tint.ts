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

/**
 * Mini-card border when image analysis is the only incomplete pipeline (matches sidebar red/amber).
 * `green` means “ignore pending image analysis” — use neutral border, never a success/green outline.
 */
export function photoPendingTintToBorderClass(tint: PhotoPendingFolderIconTint): string {
  switch (tint) {
    case "red":
      return "border-destructive";
    case "amber":
      return "border-amber-400";
    case "green":
      return "border-[#2a3550]";
    default:
      return "border-amber-400";
  }
}
