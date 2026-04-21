import type { FaceDetectionBox, FaceSubjectRole } from "../../src/shared/ipc";

export interface SubjectRoleConfig {
  minSizeRatioToLargest: number;
  minImageAreaRatio: number;
}

export interface FaceWithSubjectRole extends FaceDetectionBox {
  bboxShortSideRatioToLargest: number | null;
  bboxAreaImageRatio: number | null;
  subjectRole: FaceSubjectRole;
}

/**
 * Annotate each detected face with size-derived ratios and a `main` vs
 * `background` subject-role classification.
 *
 * A face is `main` when BOTH:
 *  - its short side is at least `minSizeRatioToLargest` * largest face short side, AND
 *  - its area is at least `minImageAreaRatio` * total image area.
 *
 * Otherwise it is `background`. When there is only one face it is always `main`
 * provided its area passes the image-area floor.
 */
export function classifyFaceSubjectRoles(
  faces: FaceDetectionBox[],
  imageSize: { width: number; height: number } | null,
  cfg: SubjectRoleConfig,
): FaceWithSubjectRole[] {
  if (faces.length === 0) return [];

  const imageArea =
    imageSize && imageSize.width > 0 && imageSize.height > 0
      ? imageSize.width * imageSize.height
      : null;

  const shortSides = faces.map((face) => {
    const [x1, y1, x2, y2] = face.bbox_xyxy;
    return Math.max(0, Math.min(x2 - x1, y2 - y1));
  });
  const largestShortSide = shortSides.reduce((acc, v) => (v > acc ? v : acc), 0);

  return faces.map((face, i) => {
    const [x1, y1, x2, y2] = face.bbox_xyxy;
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    const area = w * h;

    const shortSideRatio =
      largestShortSide > 0 ? shortSides[i] / largestShortSide : null;
    const areaRatio = imageArea && imageArea > 0 ? area / imageArea : null;

    const passesShortSide =
      shortSideRatio === null || shortSideRatio >= cfg.minSizeRatioToLargest;
    const passesArea =
      areaRatio === null || areaRatio >= cfg.minImageAreaRatio;

    const subjectRole: FaceSubjectRole =
      passesShortSide && passesArea ? "main" : "background";

    return {
      ...face,
      bboxShortSideRatioToLargest: shortSideRatio,
      bboxAreaImageRatio: areaRatio,
      subjectRole,
    };
  });
}
