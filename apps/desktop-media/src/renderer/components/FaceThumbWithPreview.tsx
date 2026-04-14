import { useState, type MouseEvent, type ReactElement } from "react";
import { Tag } from "lucide-react";
import {
  FaceHoverPhotoPreviewLayer,
  getFaceHoverPreviewOuterWidth,
} from "@emk/media-viewer";
import type { FaceClusterFaceInfo } from "../../shared/ipc";
import { computeFaceCropStyle, toFileUrl } from "./face-cluster-utils";

type PreviewSide = "left" | "right";

export function FaceThumbWithPreview({
  faceInfo,
  sizeClassName,
  isDeclined,
  onOpenPhoto,
}: {
  faceInfo: FaceClusterFaceInfo | null;
  sizeClassName: string;
  isDeclined?: boolean;
  onOpenPhoto?: () => void;
}): ReactElement {
  const [showPreview, setShowPreview] = useState(false);
  const [previewSide, setPreviewSide] = useState<PreviewSide>("right");

  if (!faceInfo) {
    return (
      <div className={`flex ${sizeClassName} items-center justify-center rounded-md bg-muted`}>
        <Tag className="size-4 text-muted-foreground/40" />
      </div>
    );
  }

  const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const previewWidth = getFaceHoverPreviewOuterWidth(faceInfo.imageWidth, faceInfo.imageHeight);
    const gap = 12;
    const canShowRight = rect.right + gap + previewWidth <= viewportWidth;
    setPreviewSide(canShowRight ? "right" : "left");
    setShowPreview(true);
  };

  const previewSrc = toFileUrl(faceInfo.sourcePath);

  const thumb = (
    <div
      className={`${sizeClassName} rounded-md bg-muted bg-cover bg-center ${
        isDeclined ? "opacity-20 blur-[1px]" : ""
      }`}
      style={computeFaceCropStyle(faceInfo)}
      role="img"
      aria-label="Face"
    />
  );

  return (
    <div
      className="group relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPreview(false)}
    >
      {onOpenPhoto ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPhoto();
          }}
          className="relative block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
          aria-label="Open photo for this face"
        >
          {thumb}
        </button>
      ) : (
        thumb
      )}
      <FaceHoverPhotoPreviewLayer
        imageSrc={previewSrc}
        imageWidth={faceInfo.imageWidth}
        imageHeight={faceInfo.imageHeight}
        show={showPreview}
        side={previewSide}
      />
    </div>
  );
}
