import type { CSSProperties } from "react";

export const themeBg = "hsl(var(--background, 222 47% 11%) / 1)";
export const DEFAULT_MAX_IMAGE_UPSCALE_FACTOR = 1.5;
export const DEFAULT_COVER_ASPECT_MISMATCH_THRESHOLD = 0.15;

export type ThumbSize = "auto" | "normal" | "large";

export const THUMB_DIMENSIONS: Record<"normal" | "large", { railWidth: number; slideHeight: number }> = {
  normal: { railWidth: 140, slideHeight: 90 },
  large: { railWidth: 210, slideHeight: 135 },
};

export type FrameSize = { width: number; height: number };
export type ImageNaturalSize = { width: number; height: number };
export type MainImageFitResult = {
  style: CSSProperties;
  mode: "contain" | "cover" | "capped-contain";
  containScale?: number;
  aspectRatioMismatch?: number;
  naturalWidth?: number;
  naturalHeight?: number;
};

export const viewerStyles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483647,
    display: "flex",
    background: themeBg,
  },
  shell: {
    display: "grid",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  thumbsRail: {
    height: "100%",
    padding: 10,
    borderRight: "1px solid rgba(148, 163, 184, 0.25)",
    boxSizing: "border-box",
    background: "rgba(15, 23, 42, 0.7)",
    overflow: "hidden",
  },
  thumbSlide: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 6,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  main: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    minWidth: 0,
    minHeight: 0,
    background: themeBg,
  },
  mainImageWrap: {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: themeBg,
  },
  mainImage: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  controlsOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 50,
    pointerEvents: "none",
  },
  controlsRegion: {
    position: "relative",
    height: "100%",
  },
  topBar: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    zIndex: 50,
    pointerEvents: "none",
  },
  controls: {
    display: "flex",
    gap: 8,
    pointerEvents: "auto",
  },
  controlsLeft: {
    position: "absolute",
    left: 12,
    top: 0,
  },
  controlsRight: {
    position: "absolute",
    right: 12,
    top: 0,
  },
  button: {
    border: "1px solid rgba(148, 163, 184, 0.4)",
    borderRadius: 8,
    width: 36,
    height: 36,
    background: "rgba(15, 23, 42, 0.72)",
    color: "#f8fafc",
    cursor: "pointer",
    fontSize: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  navButton: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 42,
    height: 42,
    borderRadius: 8,
    border: "1px solid rgba(148, 163, 184, 0.4)",
    background: "rgba(15, 23, 42, 0.72)",
    color: "#f8fafc",
    cursor: "pointer",
    zIndex: 35,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    pointerEvents: "auto",
  },
  navLeft: {
    left: 14,
  },
  navRight: {
    right: 14,
  },
  infoPanelContent: {
    position: "absolute",
    inset: 0,
    zIndex: 40,
    overflow: "auto",
    background: themeBg,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};
