import { useEffect, useMemo, useState } from "react";
import { FlipVertical2, RotateCw } from "lucide-react";
import "./image-edit-suggestions.css";
import { toHeadlineLabel } from "@emk/shared-contracts";
import {
  normalizeCropBox,
  drawRotatedImage,
  drawCroppedImage,
  drawFlippedImage,
  canvasToObjectUrl,
  loadImage,
} from "./image-transform-canvas";

type PriorityLevel = "high" | "medium" | "low" | "unknown";

export interface ImageEditSuggestion {
  editType: string;
  priority?: "high" | "medium" | "low" | null;
  reason?: string | null;
  rotationAngleClockwise?: 90 | 180 | 270 | null;
  cropRel?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ImageEditSuggestionsItem {
  id: string;
  title: string;
  imageUrl?: string | null;
  suggestions: ImageEditSuggestion[];
}

export interface ImageEditSuggestionsViewProps {
  hasFolderSelected: boolean;
  items: ImageEditSuggestionsItem[];
  onBackToPhotos: () => void;
}

interface PreviewTransform {
  rotationAngle: 90 | 180 | 270 | null;
  cropBox: { x: number; y: number; width: number; height: number } | null;
  previewSuggestionIndexes: Set<number>;
}

interface SuggestionRow {
  item: ImageEditSuggestionsItem;
  highPrioritySuggestions: Array<{ suggestion: ImageEditSuggestion; index: number }>;
  otherSuggestions: Array<{ suggestion: ImageEditSuggestion; index: number }>;
  rowPriority: PriorityLevel;
  hasActionablePreview: boolean;
  transform: PreviewTransform;
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "failed";
  src: string | null;
  errorMessage: string | null;
}

const UI_TEXT = {
  title: "Image edit suggestions",
  backToPhotos: "Back to photos",
  noFolder: "Select a folder to view image edit suggestions.",
  noSuggestions: "No AI image edit suggestions found for this folder.",
  suggestedSummary: "Suggested photos",
  highPrioritySummary: "High priority photos",
  originalLabel: "Original image",
  suggestedLabel: "Suggested preview",
  previewFailed: "Unable to render preview for this image.",
  highPrioritySection: "High priority suggestions",
  otherImprovementsSection: "Other improvements",
  applyChanges: "Apply changes",
  applyChangesSoon: "Placeholder only - coming soon.",
  shownInPreview: "Shown in preview",
  tagRotate: "Rotate",
  tagCrop: "Crop",
  rotateClockwise: "Rotate clockwise",
  flipVertical: "Flip vertically",
  noActivePreviewAdjustments: "No active preview adjustments. Toggle Rotate/Crop tags to re-enable.",
} as const;

function getPriorityLevel(priority: unknown): PriorityLevel {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "unknown";
}

function getPriorityRank(priority: PriorityLevel): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  if (priority === "low") return 2;
  return 3;
}

function computeTransform(suggestions: ImageEditSuggestion[]): PreviewTransform {
  let rotationAngle: 90 | 180 | 270 | null = null;
  let cropBox: { x: number; y: number; width: number; height: number } | null = null;
  const previewSuggestionIndexes = new Set<number>();

  suggestions.forEach((suggestion, index) => {
    if (
      rotationAngle === null &&
      (suggestion.rotationAngleClockwise === 90 ||
        suggestion.rotationAngleClockwise === 180 ||
        suggestion.rotationAngleClockwise === 270)
    ) {
      rotationAngle = suggestion.rotationAngleClockwise;
      previewSuggestionIndexes.add(index);
    }

    const cropRel = suggestion.cropRel;
    if (
      cropBox === null &&
      cropRel &&
      Number.isFinite(cropRel.x) &&
      Number.isFinite(cropRel.y) &&
      Number.isFinite(cropRel.width) &&
      Number.isFinite(cropRel.height)
    ) {
      cropBox = cropRel;
      previewSuggestionIndexes.add(index);
    }
  });

  return { rotationAngle, cropBox, previewSuggestionIndexes };
}

function SuggestionPreview({
  title,
  imageUrl,
  transform,
}: {
  title: string;
  imageUrl: string | null;
  transform: PreviewTransform;
}) {
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
              <RotateCw className="image-edit-preview-icon" />
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
              <FlipVertical2 className="image-edit-preview-icon" />
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
        <div className="image-edit-preview-placeholder">Generating preview...</div>
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
        <span>{UI_TEXT.applyChangesSoon}</span>
      </div>
    </div>
  );
}

function SuggestionSection({
  title,
  items,
  previewSuggestionIndexes,
}: {
  title: string;
  items: Array<{ suggestion: ImageEditSuggestion; index: number }>;
  previewSuggestionIndexes: Set<number>;
}) {
  const visibleItems = items.filter(
    ({ suggestion }) => suggestion.editType !== "rotate" && suggestion.editType !== "crop",
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="image-edit-suggestions-section">
      <h4>{title}</h4>
      <ul className="image-edit-suggestions-list">
        {visibleItems.map(({ suggestion, index }) => {
          const priority = getPriorityLevel(suggestion.priority);
          const editTypeLabel = toHeadlineLabel(suggestion.editType);
          const reason = typeof suggestion.reason === "string" ? suggestion.reason.trim() : "";
          const rotationDegrees =
            suggestion.editType === "rotate" &&
            (suggestion.rotationAngleClockwise === 90 ||
              suggestion.rotationAngleClockwise === 180 ||
              suggestion.rotationAngleClockwise === 270)
              ? suggestion.rotationAngleClockwise
              : null;
          return (
            <li key={`${suggestion.editType}-${index}`} className="image-edit-suggestion-item">
              <div className="image-edit-suggestion-heading">
                <strong>{editTypeLabel}</strong>
                <span className={`image-edit-priority-chip priority-${priority}`}>
                  {priority === "unknown" ? "Unspecified" : `${toHeadlineLabel(priority)} priority`}
                </span>
              </div>
              {rotationDegrees !== null ? (
                <p>{`Clockwise rotation: ${rotationDegrees}\u00b0`}</p>
              ) : null}
              {reason ? <p>{reason}</p> : null}
              {previewSuggestionIndexes.has(index) ? (
                <div className="image-edit-suggestion-preview-flag">{UI_TEXT.shownInPreview}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ImageEditSuggestionsView({
  hasFolderSelected,
  items,
  onBackToPhotos,
}: ImageEditSuggestionsViewProps) {
  const rows = useMemo((): SuggestionRow[] => {
    const withSuggestions = items
      .filter((item) => item.suggestions.length > 0)
      .map((item): SuggestionRow => {
        const highPrioritySuggestions = item.suggestions
          .map((suggestion, index) => ({ suggestion, index }))
          .filter(({ suggestion }) => getPriorityLevel(suggestion.priority) === "high");
        const otherSuggestions = item.suggestions
          .map((suggestion, index) => ({ suggestion, index }))
          .filter(({ suggestion }) => getPriorityLevel(suggestion.priority) !== "high");
        const rowPriority = item.suggestions.reduce<PriorityLevel>((best, suggestion) => {
          const candidate = getPriorityLevel(suggestion.priority);
          return getPriorityRank(candidate) < getPriorityRank(best) ? candidate : best;
        }, "unknown");
        const transform = computeTransform(item.suggestions);
        const hasActionablePreview = transform.rotationAngle !== null || transform.cropBox !== null;
        return {
          item,
          highPrioritySuggestions,
          otherSuggestions,
          rowPriority,
          hasActionablePreview,
          transform,
        };
      });

    withSuggestions.sort((a, b) => {
      if (a.hasActionablePreview !== b.hasActionablePreview) {
        return a.hasActionablePreview ? -1 : 1;
      }
      const priorityDiff = getPriorityRank(a.rowPriority) - getPriorityRank(b.rowPriority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.item.title.localeCompare(b.item.title);
    });
    return withSuggestions;
  }, [items]);

  const highPriorityPhotoCount = useMemo(
    () => rows.filter((row) => row.rowPriority === "high").length,
    [rows],
  );

  if (!hasFolderSelected) {
    return <div className="empty-state">{UI_TEXT.noFolder}</div>;
  }

  return (
    <section className="image-edit-suggestions-view">
      <header className="image-edit-suggestions-header">
        <div>
          <h3>{UI_TEXT.title}</h3>
          <p>
            {UI_TEXT.suggestedSummary}: {rows.length} | {UI_TEXT.highPrioritySummary}:{" "}
            {highPriorityPhotoCount}
          </p>
        </div>
        <button type="button" onClick={onBackToPhotos}>
          {UI_TEXT.backToPhotos}
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="empty-state">{UI_TEXT.noSuggestions}</div>
      ) : (
        <div className="image-edit-suggestions-rows">
          {rows.map((row) => (
            <article key={row.item.id} className="image-edit-row">
              <div className="image-edit-original-column">
                <h4>{UI_TEXT.originalLabel}</h4>
                <img src={row.item.imageUrl ?? ""} alt={row.item.title} />
                <div className="image-edit-photo-title">{row.item.title}</div>
              </div>
              <div className="image-edit-details-column">
                <SuggestionPreview
                  title={row.item.title}
                  imageUrl={row.item.imageUrl ?? null}
                  transform={row.transform}
                />
                <SuggestionSection
                  title={UI_TEXT.highPrioritySection}
                  items={row.highPrioritySuggestions}
                  previewSuggestionIndexes={row.transform.previewSuggestionIndexes}
                />
                <SuggestionSection
                  title={UI_TEXT.otherImprovementsSection}
                  items={row.otherSuggestions}
                  previewSuggestionIndexes={row.transform.previewSuggestionIndexes}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
