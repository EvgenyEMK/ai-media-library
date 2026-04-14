"use client";

import type { ReactElement } from "react";

/** Prior square hover was 288px; scaled by 1.5 on the long edge. */
export const FACE_HOVER_PREVIEW_MAX_EDGE_PX = 432;

export function getFaceHoverPreviewDisplaySize(
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined,
  maxEdgePx: number = FACE_HOVER_PREVIEW_MAX_EDGE_PX,
): { width: number; height: number } {
  const iw = typeof imageWidth === "number" && imageWidth > 0 ? imageWidth : null;
  const ih = typeof imageHeight === "number" && imageHeight > 0 ? imageHeight : null;
  if (!iw || !ih) {
    return { width: maxEdgePx, height: maxEdgePx };
  }
  if (iw >= ih) {
    return { width: maxEdgePx, height: Math.max(1, Math.round((maxEdgePx * ih) / iw)) };
  }
  return { width: Math.max(1, Math.round((maxEdgePx * iw) / ih)), height: maxEdgePx };
}

/** Width used for left/right flip (preview + 4px border on each side). */
export function getFaceHoverPreviewOuterWidth(
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined,
): number {
  const { width } = getFaceHoverPreviewDisplaySize(imageWidth, imageHeight);
  return width + 8;
}

type PreviewSide = "left" | "right";

export function FaceHoverPhotoPreviewLayer({
  imageSrc,
  imageWidth,
  imageHeight,
  show,
  side,
}: {
  imageSrc: string;
  imageWidth: number | null | undefined;
  imageHeight: number | null | undefined;
  show: boolean;
  side: PreviewSide;
}): ReactElement | null {
  if (!show) {
    return null;
  }
  const { width, height } = getFaceHoverPreviewDisplaySize(imageWidth, imageHeight);
  return (
    <div
      className={`pointer-events-none absolute top-1/2 z-40 hidden -translate-y-1/2 group-hover:block ${
        side === "right" ? "left-full ml-3" : "right-full mr-3"
      }`}
    >
      <div
        className="box-border rounded-lg border-4 border-white bg-muted shadow-xl"
        style={{ width: width + 8, height: height + 8 }}
      >
        <img
          src={imageSrc}
          alt=""
          width={width}
          height={height}
          className="block object-contain"
          style={{ width, height }}
          draggable={false}
        />
      </div>
    </div>
  );
}
