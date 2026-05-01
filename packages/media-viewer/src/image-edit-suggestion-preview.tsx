import { useEffect, useState, type ReactElement } from "react";
import {
  normalizeCropBox,
  drawRotatedImage,
  drawCroppedImage,
  drawFlippedImage,
  canvasToObjectUrl,
  loadImage,
} from "./image-transform-canvas";
import type { PreviewTransform } from "./image-edit-suggestions-types";

interface PreviewState {
  status: "idle" | "loading" | "ready" | "failed";
  src: string | null;
  errorMessage: string | null;
}

const UI_TEXT = {
  suggestedLabel: "Suggested preview",
  previewFailed: "Unable to render preview for this image.",
  applyChanges: "Apply changes",
  applyChangesSoon: "Placeholder only - coming soon.",
  tagRotate: "Rotate",
  tagCrop: "Crop",
  rotateClockwise: "Rotate clockwise",
  flipVertical: "Flip vertically",
  noActivePreviewAdjustments: "No active preview adjustments. Toggle Rotate/Crop tags to re-enable.",
} as const;

function RotateCwIcon(): ReactElement {
  return (
    <svg className="image-edit-preview-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a9 9 0 1 1-2.64-6.36L21 8.25M21 3v5.25h-5.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlipVerticalIcon(): ReactElement {
  return (
    <svg className="image-edit-preview-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v18M4 8l8-5 8 5M4 16l8 5 8-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SuggestionPreview({
  title,
  imageUrl,
  transform,
  applyChangesNote = UI_TEXT.applyChangesSoon,
}: {
  title: string;
  imageUrl: string | null;
  transform: PreviewTransform;
  applyChangesNote?: string;
}): ReactElement | null {
  const [previewState, setPreviewState] = useState<PreviewState>({
    status: "idle",
    src: null,
    errorMessage: null,
  });

  const hasRotateSuggestion = transform.rotationAngle !== null;
  const hasCropSuggestion = transform.cropBox !== null;
  const [rotateEnabled, setRotateEnabled] = useState(hasRotateSuggestion);
  const [cropEnabled, setCropEnabled] = useState(hasCropSuggestion);
  const [rotationAngle, setRotationAngle] = useState<90 | 180 | 270 | null>(transform.rotationAngle);
  const [flipVerticalEnabled, setFlipVerticalEnabled] = useState(false);

  useEffect(() => {
    const rotateAvailable = transform.rotationAngle !== null;
    const cropAvailable = transform.cropBox !== null;
    setRotateEnabled(rotateAvailable);
    setCropEnabled(cropAvailable);
    setRotationAngle(transform.rotationAngle);
    setFlipVerticalEnabled(false);
  }, [transform.rotationAngle, transform.cropBox]);

  const effectiveRotation = rotateEnabled ? rotationAngle : null;
  const effectiveCrop = cropEnabled ? transform.cropBox : null;
  const hasAnySuggestion = hasRotateSuggestion || hasCropSuggestion;
  const hasVisualSuggestion =
    effectiveRotation !== null || effectiveCrop !== null || flipVerticalEnabled;

  useEffect(() => {
    let isActive = true;
    let currentObjectUrl: string | null = null;

    if (!hasAnySuggestion) {
      setPreviewState({ status: "idle", src: null, errorMessage: null });
      return () => undefined;
    }

    if (!imageUrl) {
      setPreviewState({
        status: "failed",
        src: null,
        errorMessage: UI_TEXT.previewFailed,
      });
      return () => undefined;
    }

    setPreviewState({ status: "loading", src: null, errorMessage: null });

    void (async () => {
      try {
        const image = await loadImage(imageUrl);
        if (!isActive) return;
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const rotatedCanvas = drawRotatedImage(image, sourceWidth, sourceHeight, effectiveRotation);
        const normalizedCrop = normalizeCropBox(effectiveCrop);
        const croppedCanvas = drawCroppedImage(rotatedCanvas, normalizedCrop);
        const finalCanvas = drawFlippedImage(croppedCanvas, flipVerticalEnabled);
        currentObjectUrl = await canvasToObjectUrl(finalCanvas);
        if (!isActive) {
          if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
          return;
        }
        setPreviewState({
          status: "ready",
          src: currentObjectUrl,
          errorMessage: null,
        });
      } catch {
        if (!isActive) return;
        setPreviewState({
          status: "failed",
          src: null,
          errorMessage: UI_TEXT.previewFailed,
        });
      }
    })();

    return () => {
      isActive = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [hasAnySuggestion, hasVisualSuggestion, imageUrl, effectiveCrop, effectiveRotation, flipVerticalEnabled]);

  if (!hasAnySuggestion) {
    return null;
  }

  const handleRotateClockwise = (): void => {
    setRotateEnabled(true);
    setRotationAngle((current) => {
      if (current === 90) return 180;
      if (current === 180) return 270;
      return 90;
    });
  };

  return (
    <div className="image-edit-preview-card">
      <div className="image-edit-preview-heading">
        <h4>{UI_TEXT.suggestedLabel}</h4>
        {hasRotateSuggestion ? (
          <>
            <button
              type="button"
              className={
                rotateEnabled
                  ? "image-edit-preview-tag image-edit-preview-tag-active"
                  : "image-edit-preview-tag image-edit-preview-tag-inactive"
              }
              onClick={() => setRotateEnabled((current) => !current)}
              title={rotateEnabled ? "Disable rotate" : "Enable rotate"}
            >
              {UI_TEXT.tagRotate}
            </button>
            <button
              type="button"
              className="image-edit-preview-icon-btn"
              onClick={handleRotateClockwise}
              title={UI_TEXT.rotateClockwise}
              aria-label={UI_TEXT.rotateClockwise}
            >
              <RotateCwIcon />
            </button>
            <button
              type="button"
              className={
                flipVerticalEnabled
                  ? "image-edit-preview-icon-btn image-edit-preview-icon-btn-active"
                  : "image-edit-preview-icon-btn"
              }
              onClick={() => setFlipVerticalEnabled((current) => !current)}
              title={UI_TEXT.flipVertical}
              aria-label={UI_TEXT.flipVertical}
            >
              <FlipVerticalIcon />
            </button>
          </>
        ) : null}
        {hasCropSuggestion ? (
          <button
            type="button"
            className={
              cropEnabled
                ? "image-edit-preview-tag image-edit-preview-tag-active"
                : "image-edit-preview-tag image-edit-preview-tag-inactive"
            }
            onClick={() => setCropEnabled((current) => !current)}
            title={cropEnabled ? "Disable crop" : "Enable crop"}
          >
            {UI_TEXT.tagCrop}
          </button>
        ) : null}
      </div>
      {previewState.status === "ready" && previewState.src ? (
        <img src={previewState.src} alt={`${title} suggested preview`} />
      ) : !hasVisualSuggestion ? (
        <div className="image-edit-preview-placeholder">{UI_TEXT.noActivePreviewAdjustments}</div>
      ) : previewState.status === "loading" ? (
        <div className="image-edit-preview-loading" role="status" aria-live="polite">
          <div className="image-edit-preview-spinner" aria-hidden="true" />
          <span>Generating preview...</span>
        </div>
      ) : (
        <div className="image-edit-preview-placeholder">
          {previewState.errorMessage ?? UI_TEXT.previewFailed}
        </div>
      )}
      <div className="image-edit-cta-row">
        <button
          type="button"
          className="image-edit-apply-button"
          disabled={previewState.status !== "ready"}
          onClick={() => {
            // Placeholder: apply flow will be implemented in a follow-up.
          }}
        >
          {UI_TEXT.applyChanges}
        </button>
        <span>{applyChangesNote}</span>
      </div>
    </div>
  );
}
