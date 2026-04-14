import type { CSSProperties } from "react";
import { clamp } from "@emk/shared-contracts";

/**
 * Minimal face-box shape for sorting and thumbnails (no app/types import).
 */
export type FaceTagsListBoundingBoxLike = {
  person_face_bounding_box?: {
    width?: number | null;
    height?: number | null;
    x?: number | null;
    y?: number | null;
    x_min?: number | null;
    x_max?: number | null;
    y_min?: number | null;
    y_max?: number | null;
  } | null;
  provider_raw_bounding_box?: {
    box?: {
      mp_width?: number;
      mp_height?: number;
      width?: number;
      height?: number;
    };
  } | null;
};

export interface FaceThumbnailPixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function estimateFaceBoxSortMetric(box: FaceTagsListBoundingBoxLike): number {
  const fb = box.person_face_bounding_box;
  if (fb) {
    if (typeof fb.width === "number" && typeof fb.height === "number" && fb.width > 0 && fb.height > 0) {
      return fb.width * fb.height;
    }
    if (
      typeof fb.x_min === "number" &&
      typeof fb.x_max === "number" &&
      typeof fb.y_min === "number" &&
      typeof fb.y_max === "number"
    ) {
      const w = Math.abs(fb.x_max - fb.x_min);
      const h = Math.abs(fb.y_max - fb.y_min);
      if (w > 0 && h > 0) {
        return w * h;
      }
    }
  }
  const raw = box.provider_raw_bounding_box?.box;
  if (raw) {
    const w = typeof raw.mp_width === "number" ? raw.mp_width : raw.width;
    const h = typeof raw.mp_height === "number" ? raw.mp_height : raw.height;
    if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
      return w * h;
    }
  }
  return 0;
}

/** Original indices, largest face box first (stable tie-break by index). */
export function getFaceDisplayOrderIndicesByBoxArea<T extends FaceTagsListBoundingBoxLike>(
  boxes: readonly T[],
): number[] {
  return boxes
    .map((box, index) => ({ index, metric: estimateFaceBoxSortMetric(box) }))
    .sort((a, b) => {
      if (b.metric !== a.metric) {
        return b.metric - a.metric;
      }
      return a.index - b.index;
    })
    .map((x) => x.index);
}

export function getFaceTagsSortedBoxesAndOrder<T extends FaceTagsListBoundingBoxLike>(
  boxes: readonly T[],
): { sortedBoxes: T[]; displayToOriginal: number[] } {
  const displayToOriginal = getFaceDisplayOrderIndicesByBoxArea(boxes);
  const sortedBoxes = displayToOriginal.map((i) => boxes[i]);
  return { sortedBoxes, displayToOriginal };
}

/**
 * CSS background thumbnail focused on a face. Does not impose a minimum face
 * fraction (unlike older code), so very small boxes still zoom in instead of
 * showing unrelated context.
 */
export function computeFaceThumbnailBackgroundStyle(options: {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  faceBox: FaceThumbnailPixelRect;
  /** Upper bound for background-size % to keep CSS reasonable (default 900). */
  maxZoomPercent?: number;
}): CSSProperties {
  const { imageUrl, imageWidth, imageHeight, faceBox, maxZoomPercent = 900 } = options;
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {};
  }
  if (faceBox.width <= 0 || faceBox.height <= 0) {
    return {};
  }

  const wFrac = Math.max(faceBox.width / imageWidth, 1e-5);
  const hFrac = Math.max(faceBox.height / imageHeight, 1e-5);
  const centerX = clamp((faceBox.x + faceBox.width / 2) / imageWidth, 0, 1);
  const centerY = clamp((faceBox.y + faceBox.height / 2) / imageHeight, 0, 1);
  const scaleW = Math.min(100 / wFrac, maxZoomPercent);
  const scaleH = Math.min(100 / hFrac, maxZoomPercent);
  const backgroundSize = scaleW >= scaleH ? `${scaleW}% auto` : `auto ${scaleH}%`;

  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundPosition: `${centerX * 100}% ${centerY * 100}%`,
    backgroundSize,
  };
}
