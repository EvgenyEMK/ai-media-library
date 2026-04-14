import type { CSSProperties, ReactElement } from "react";
import type { CanonicalBoundingBox, FaceBeingBoundingBox } from "@emk/shared-contracts";

const NORMALIZED_RANGE = 1000;

export interface FaceOverlayImageInfo {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FaceBoundingBoxOverlayProps {
  boundingBoxes: FaceBeingBoundingBox[];
  imageInfo: FaceOverlayImageInfo;
  selectedIndex: number | null;
  onBoxClick: (index: number) => void;
  originalWidth?: number | null;
  originalHeight?: number | null;
  detectionSize?: { width: number; height: number } | null;
  getPersonLabel?: (box: FaceBeingBoundingBox, index: number) => string | null;
}

function fromNormalizedBox(
  box: CanonicalBoundingBox | null | undefined,
  imageInfo: FaceOverlayImageInfo,
): OverlayRect | null {
  if (
    !box ||
    typeof box.x_min !== "number" ||
    typeof box.x_max !== "number" ||
    typeof box.y_min !== "number" ||
    typeof box.y_max !== "number"
  ) {
    return null;
  }

  const left = (box.x_min / NORMALIZED_RANGE) * imageInfo.width;
  const top = (box.y_min / NORMALIZED_RANGE) * imageInfo.height;
  const width = ((box.x_max - box.x_min) / NORMALIZED_RANGE) * imageInfo.width;
  const height = ((box.y_max - box.y_min) / NORMALIZED_RANGE) * imageInfo.height;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { left, top, width, height };
}

function fromPixelBox(
  box: CanonicalBoundingBox | null | undefined,
  imageInfo: FaceOverlayImageInfo,
  detectionSize: { width: number; height: number } | null | undefined,
  originalWidth: number | null | undefined,
  originalHeight: number | null | undefined,
): OverlayRect | null {
  if (!box) {
    return null;
  }

  const sourceWidth =
    box.image_width ??
    detectionSize?.width ??
    originalWidth ??
    imageInfo.naturalWidth ??
    imageInfo.width;
  const sourceHeight =
    box.image_height ??
    detectionSize?.height ??
    originalHeight ??
    imageInfo.naturalHeight ??
    imageInfo.height;

  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const originX = typeof box.mp_x === "number" ? box.mp_x : typeof box.x === "number" ? box.x : undefined;
  const originY = typeof box.mp_y === "number" ? box.mp_y : typeof box.y === "number" ? box.y : undefined;
  const width = typeof box.mp_width === "number" ? box.mp_width : typeof box.width === "number" ? box.width : undefined;
  const height =
    typeof box.mp_height === "number" ? box.mp_height : typeof box.height === "number" ? box.height : undefined;

  if (
    typeof originX !== "number" ||
    typeof originY !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }

  const scaleX = imageInfo.width / sourceWidth;
  const scaleY = imageInfo.height / sourceHeight;

  return {
    left: originX * scaleX,
    top: originY * scaleY,
    width: width * scaleX,
    height: height * scaleY,
  };
}

function resolveOverlayRect(
  box: CanonicalBoundingBox | null | undefined,
  imageInfo: FaceOverlayImageInfo,
  detectionSize: { width: number; height: number } | null | undefined,
  originalWidth: number | null | undefined,
  originalHeight: number | null | undefined,
): OverlayRect | null {
  return (
    fromNormalizedBox(box, imageInfo) ??
    fromPixelBox(box, imageInfo, detectionSize, originalWidth, originalHeight)
  );
}

const baseBoxStyle: CSSProperties = {
  position: "absolute",
  borderStyle: "solid",
  borderWidth: 2,
  cursor: "pointer",
  transition: "all 120ms ease",
};

export function FaceBoundingBoxOverlay({
  boundingBoxes,
  imageInfo,
  selectedIndex,
  onBoxClick,
  originalWidth,
  originalHeight,
  detectionSize,
  getPersonLabel,
}: FaceBoundingBoxOverlayProps): ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {boundingBoxes.map((box, index) => {
        const isSelected = selectedIndex === index;
        const isVisible = selectedIndex === null || isSelected;
        if (!isVisible) {
          return null;
        }

        const personRect = resolveOverlayRect(
          box.person_bounding_box ?? null,
          imageInfo,
          detectionSize,
          originalWidth,
          originalHeight,
        );
        const faceRect = resolveOverlayRect(
          box.person_face_bounding_box ?? null,
          imageInfo,
          detectionSize,
          originalWidth,
          originalHeight,
        );

        const finalPersonRect = personRect
          ? {
              left: personRect.left + imageInfo.offsetX,
              top: personRect.top + imageInfo.offsetY,
              width: personRect.width,
              height: personRect.height,
            }
          : null;
        const finalFaceRect = faceRect
          ? {
              left: faceRect.left + imageInfo.offsetX,
              top: faceRect.top + imageInfo.offsetY,
              width: faceRect.width,
              height: faceRect.height,
            }
          : null;

        const label = getPersonLabel?.(box, index) ?? "Person";

        return (
          <div key={index} style={{ pointerEvents: "auto" }}>
            {finalPersonRect ? (
              <div
                style={{
                  ...baseBoxStyle,
                  left: finalPersonRect.left,
                  top: finalPersonRect.top,
                  width: finalPersonRect.width,
                  height: finalPersonRect.height,
                  borderColor: isSelected ? "rgba(59,130,246,1)" : "rgba(147,197,253,1)",
                  backgroundColor: isSelected ? "rgba(59,130,246,0.1)" : "rgba(147,197,253,0.05)",
                }}
                onClick={() => onBoxClick(index)}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -24,
                    left: 0,
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    background: isSelected ? "rgba(59,130,246,1)" : "rgba(147,197,253,0.9)",
                    color: isSelected ? "white" : "#1e3a8a",
                  }}
                >
                  {label}
                </div>
              </div>
            ) : null}
            {finalFaceRect ? (
              <div
                style={{
                  position: "absolute",
                  left: finalFaceRect.left,
                  top: finalFaceRect.top,
                  width: finalFaceRect.width,
                  height: finalFaceRect.height,
                  border: `2px solid ${isSelected ? "rgba(250,204,21,1)" : "rgba(253,224,71,1)"}`,
                  borderRadius: 16,
                  background: isSelected ? "rgba(250,204,21,0.2)" : "rgba(253,224,71,0.1)",
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
