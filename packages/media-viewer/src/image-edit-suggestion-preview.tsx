import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  normalizeCropBox,
  drawRotatedImage,
  drawCroppedImage,
  drawFlippedImage,
  canvasToObjectUrl,
  loadImage,
} from "./image-transform-canvas";
import type {
  ImageEditSuggestionsVariant,
  PreviewTransform,
  RotationReviewSaveSelection,
} from "./image-edit-suggestions-types";

interface PreviewState {
  status: "idle" | "loading" | "ready" | "failed";
  src: string | null;
  errorMessage: string | null;
}

const UI_TEXT = {
  suggestedLabel: "Suggested preview",
  previewFailed: "Unable to render preview for this image.",
  save: "Save",
  saving: "Saving...",
  discard: "Discard",
  discarding: "Discarding...",
  saved: "Saved",
  rotationNotNeeded: "Image rotation not needed - won't show again",
  confidenceUnavailable: "AI model confidence: n/a",
  tagRotate: "Rotate",
  tagCrop: "Crop",
  rotateClockwise: "Rotate clockwise",
  flipVertical: "Flip vertically",
  noActivePreviewAdjustments: "No active preview adjustments. Toggle Rotate/Crop tags to re-enable.",
} as const;

function RotateCwIcon(): ReactElement {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function CheckStatusIcon(): ReactElement {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16.25 5.75 8.5 13.5 4.75 9.75"
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
  variant = "default",
  confidence = null,
  saving = false,
  discarding = false,
  actionError,
  confirmation,
  onRotationSave,
  onRotationDiscard,
}: {
  title: string;
  imageUrl: string | null;
  transform: PreviewTransform;
  variant?: ImageEditSuggestionsVariant;
  confidence?: number | null;
  saving?: boolean;
  discarding?: boolean;
  actionError?: string;
  confirmation?: { status: "saved" | "discarded"; revision: number };
  onRotationSave?: (selection: RotationReviewSaveSelection) => void;
  onRotationDiscard?: () => void;
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
  const [confirmedSelectionKey, setConfirmedSelectionKey] = useState<string | null>(null);
  const selectionKeyRef = useRef<string | null>(null);

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
  const confidenceLabel = typeof confidence === "number" && Number.isFinite(confidence)
    ? `AI model confidence: ${Math.round(confidence * 100)}%`
    : UI_TEXT.confidenceUnavailable;
  const selectionKey = JSON.stringify({
    rotation: effectiveRotation,
    crop: effectiveCrop,
    flipVertical: flipVerticalEnabled,
  });
  selectionKeyRef.current = selectionKey;
  const confirmedStatus =
    confirmation && confirmedSelectionKey === selectionKey ? confirmation.status : null;

  useEffect(() => {
    if (!confirmation) {
      setConfirmedSelectionKey(null);
      return;
    }
    setConfirmedSelectionKey(selectionKeyRef.current);
  }, [confirmation?.revision, confirmation?.status]);

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
  const handleRotationSave = (): void => {
    if (!onRotationSave || effectiveRotation === null) return;
    onRotationSave({
      rotationAngleClockwise: effectiveRotation,
      cropRel: effectiveCrop,
      flipVertical: flipVerticalEnabled,
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-2">
        <h4 className="m-0 text-sm font-semibold text-foreground">{UI_TEXT.suggestedLabel}</h4>
        {hasRotateSuggestion ? (
          <>
            <button
              type="button"
              className={
                rotateEnabled
                  ? "rounded-full border border-success bg-success/20 px-2 py-0.5 text-[11px] text-success-foreground"
                  : "rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
              }
              onClick={() => setRotateEnabled((current) => !current)}
              title={rotateEnabled ? "Disable rotate" : "Enable rotate"}
            >
              {UI_TEXT.tagRotate}
            </button>
            <button
              type="button"
              className="inline-flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border border-border bg-muted p-0 text-muted-foreground"
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
                  ? "inline-flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border border-success bg-success/20 p-0 text-success-foreground"
                  : "inline-flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border border-border bg-muted p-0 text-muted-foreground"
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
                ? "rounded-full border border-success bg-success/20 px-2 py-0.5 text-[11px] text-success-foreground"
                : "rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
            }
            onClick={() => setCropEnabled((current) => !current)}
            title={cropEnabled ? "Disable crop" : "Enable crop"}
          >
            {UI_TEXT.tagCrop}
          </button>
        ) : null}
      </div>
      {previewState.status === "ready" && previewState.src ? (
        <img
          className="max-h-80 w-full rounded-md border border-border bg-background object-contain"
          src={previewState.src}
          alt={`${title} suggested preview`}
        />
      ) : !hasVisualSuggestion ? (
        <div className="rounded-md border border-dashed border-border p-3.5 text-sm text-muted-foreground">
          {UI_TEXT.noActivePreviewAdjustments}
        </div>
      ) : previewState.status === "loading" ? (
        <div
          className="flex min-h-56 flex-col items-center justify-center gap-3.5 rounded-md border border-dashed border-border bg-background p-6 text-base font-semibold text-foreground"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-14 w-14 animate-spin rounded-full border-4 border-border border-t-success"
            aria-hidden="true"
          />
          <span>Generating preview...</span>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-3.5 text-sm text-muted-foreground">
          {previewState.errorMessage ?? UI_TEXT.previewFailed}
        </div>
      )}
      {variant === "rotationReview" ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2.5 max-lg:flex-col max-lg:items-start">
            {confirmedStatus === "saved" ? (
              <div className="inline-flex items-center gap-1.5 text-sm text-success">
                <CheckStatusIcon />
                <span>{UI_TEXT.saved}</span>
              </div>
            ) : confirmedStatus === "discarded" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled>
                  {UI_TEXT.discard}
                </button>
                <span className="text-sm text-success">
                  {UI_TEXT.rotationNotNeeded}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="whitespace-nowrap"
                  disabled={
                    previewState.status !== "ready" ||
                    effectiveRotation === null ||
                    saving ||
                    discarding
                  }
                  onClick={handleRotationSave}
                >
                  {saving ? UI_TEXT.saving : UI_TEXT.save}
                </button>
                <button type="button" disabled={saving || discarding} onClick={onRotationDiscard}>
                  {discarding ? UI_TEXT.discarding : UI_TEXT.discard}
                </button>
              </div>
            )}
            <span className="ml-auto whitespace-nowrap text-right text-xs text-muted-foreground max-lg:ml-0 max-lg:text-left">
              {confidenceLabel}
            </span>
          </div>
          {actionError ? <div className="text-xs text-destructive">{actionError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
