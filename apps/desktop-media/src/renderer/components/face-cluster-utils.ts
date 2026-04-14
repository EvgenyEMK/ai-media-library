import type { CSSProperties } from "react";
import { clamp } from "@emk/shared-contracts";
import type { FaceClusterFaceInfo } from "../../shared/ipc";

export function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized}`);
}

/**
 * CSS background crop for a face on a local file image.
 * `imageWidth` / `imageHeight` must be the same pixel space as the bbox (see
 * `FACE_BBOX_REF_*` SQL in the main process — often detection bitmap size, not only EXIF width).
 * Used by People workspace, face clusters, and PhotoViewer Face tags tab.
 */
export interface FaceBackgroundCropParams {
  sourcePath: string;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export function computeFaceBackgroundCropStyle(params: FaceBackgroundCropParams): CSSProperties {
  const imageUrl = toFileUrl(params.sourcePath);
  const iw = params.imageWidth;
  const ih = params.imageHeight;
  const { bboxX, bboxY, bboxWidth, bboxHeight } = params;

  if (!iw || !ih || iw <= 0 || ih <= 0) {
    return { backgroundImage: `url("${imageUrl}")`, backgroundPosition: "center", backgroundSize: "cover" };
  }

  const x = clamp(bboxX / iw, 0, 1);
  const y = clamp(bboxY / ih, 0, 1);
  const w = clamp(bboxWidth / iw, 0.05, 1);
  const h = clamp(bboxHeight / ih, 0.05, 1);
  const cx = clamp(x + w / 2, 0, 1);
  const cy = clamp(y + h / 2, 0, 1);
  const sw = 100 / w;
  const sh = 100 / h;
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundPosition: `${cx * 100}% ${cy * 100}%`,
    backgroundSize: sw > sh ? `${sw}% auto` : `auto ${sh}%`,
  };
}

export function computeFaceCropStyle(face: FaceClusterFaceInfo | null): CSSProperties {
  if (!face) return {};
  return computeFaceBackgroundCropStyle({
    sourcePath: face.sourcePath,
    bboxX: face.bboxX,
    bboxY: face.bboxY,
    bboxWidth: face.bboxWidth,
    bboxHeight: face.bboxHeight,
    imageWidth: face.imageWidth,
    imageHeight: face.imageHeight,
  });
}

export { chunkArray } from "@emk/shared-contracts";
