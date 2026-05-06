import { useMemo, type ReactElement } from "react";
import { ImageEditSuggestionsHeader } from "./image-edit-suggestions-header";
import { SuggestionPreview } from "./image-edit-suggestion-preview";
import { SuggestionSection } from "./image-edit-suggestion-section";
import type {
  ImageEditSuggestionsItem,
  ImageEditSuggestionsViewProps,
  PriorityLevel,
  PreviewTransform,
  RotationReviewSaveSelection,
} from "./image-edit-suggestions-types";
import {
  computeTransform,
  getPriorityLevel,
  getPriorityRank,
} from "./image-edit-suggestions-utils";

export type {
  ImageEditSuggestion,
  ImageEditSuggestionsItem,
  ImageEditSuggestionsPagination,
  ImageEditSuggestionsVariant,
  ImageEditSuggestionsViewProps,
  RotationReviewSaveSelection,
} from "./image-edit-suggestions-types";

interface SuggestionRow {
  item: ImageEditSuggestionsItem;
  highPrioritySuggestions: Array<{ suggestion: ImageEditSuggestionsItem["suggestions"][number]; index: number }>;
  otherSuggestions: Array<{ suggestion: ImageEditSuggestionsItem["suggestions"][number]; index: number }>;
  rowPriority: PriorityLevel;
  hasActionablePreview: boolean;
  transform: PreviewTransform;
}

const UI_TEXT = {
  title: "Image edit suggestions",
  backToPhotos: "Back to photos",
  noFolder: "Select a folder to view image edit suggestions.",
  noSuggestions: "No AI image edit suggestions found for this folder.",
  suggestedSummary: "Suggested photos",
  highPrioritySummary: "High priority photos",
  originalLabel: "Original image",
  highPrioritySection: "High priority suggestions",
  otherImprovementsSection: "Other improvements",
  loading: "Loading image edit suggestions...",
} as const;

function OriginalImage({
  item,
  onOriginalImageClick,
}: {
  item: ImageEditSuggestionsItem;
  onOriginalImageClick?: (item: ImageEditSuggestionsItem) => void;
}): ReactElement {
  const image = (
    <img
      className="max-h-80 w-full rounded-md border border-border bg-background object-contain"
      src={item.imageUrl ?? ""}
      alt={item.title}
    />
  );
  if (!onOriginalImageClick) {
    return image;
  }
  return (
    <button
      type="button"
      className="block cursor-pointer rounded-md bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => onOriginalImageClick(item)}
      title={`Open ${item.title}`}
      aria-label={`Open ${item.title}`}
    >
      {image}
    </button>
  );
}

export function ImageEditSuggestionsView({
  hasFolderSelected,
  items,
  onBackToPhotos,
  variant = "default",
  title = UI_TEXT.title,
  folderPathLabel,
  noSuggestionsMessage = UI_TEXT.noSuggestions,
  suggestedSummaryLabel = UI_TEXT.suggestedSummary,
  highPrioritySummaryLabel = UI_TEXT.highPrioritySummary,
  headerExtra,
  pagination,
  headerPagination,
  includeSubfoldersToggle,
  onClose,
  closeAriaLabel,
  loading = false,
  error = null,
  onOriginalImageClick,
  onRotationSave,
  onRotationDiscard,
  rotationActionState,
}: ImageEditSuggestionsViewProps): ReactElement {
  const rows = useMemo((): SuggestionRow[] => {
    const withSuggestions = items
      .filter((item) => item.suggestions.length > 0)
      .map((item): SuggestionRow => {
        const suggestionsWithIndexes = item.suggestions.map((suggestion, index) => ({
          suggestion,
          index,
        }));
        const highPrioritySuggestions = suggestionsWithIndexes.filter(
          ({ suggestion }) => getPriorityLevel(suggestion.priority) === "high",
        );
        const otherSuggestions = suggestionsWithIndexes.filter(
          ({ suggestion }) => getPriorityLevel(suggestion.priority) !== "high",
        );
        const rowPriority = item.suggestions.reduce<PriorityLevel>((best, suggestion) => {
          const candidate = getPriorityLevel(suggestion.priority);
          return getPriorityRank(candidate) < getPriorityRank(best) ? candidate : best;
        }, "unknown");
        const transform = computeTransform(item.suggestions);
        return {
          item,
          highPrioritySuggestions,
          otherSuggestions,
          rowPriority,
          hasActionablePreview: transform.rotationAngle !== null || transform.cropBox !== null,
          transform,
        };
      });

    withSuggestions.sort((a, b) => {
      if (variant === "rotationReview") {
        const confidenceDiff =
          (b.item.rotationReviewMeta?.confidence ?? -1) - (a.item.rotationReviewMeta?.confidence ?? -1);
        if (confidenceDiff !== 0) return confidenceDiff;
        return a.item.title.localeCompare(b.item.title);
      }
      if (a.hasActionablePreview !== b.hasActionablePreview) {
        return a.hasActionablePreview ? -1 : 1;
      }
      const priorityDiff = getPriorityRank(a.rowPriority) - getPriorityRank(b.rowPriority);
      if (priorityDiff !== 0) return priorityDiff;
      return a.item.title.localeCompare(b.item.title);
    });
    return withSuggestions;
  }, [items, variant]);

  const highPriorityPhotoCount = useMemo(
    () => rows.filter((row) => row.rowPriority === "high").length,
    [rows],
  );
  const activePagination = headerPagination ?? pagination;
  const titleSuffix =
    variant === "rotationReview" && folderPathLabel?.trim() ? folderPathLabel.trim() : null;
  const headerSummary = variant === "default"
    ? `${suggestedSummaryLabel}: ${activePagination?.total ?? rows.length} | ${highPrioritySummaryLabel}: ${highPriorityPhotoCount}`
    : null;

  if (!hasFolderSelected) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{UI_TEXT.noFolder}</div>;
  }

  return (
    <section className="flex flex-col gap-3.5">
      <ImageEditSuggestionsHeader
        title={title}
        titleSuffix={titleSuffix}
        summary={headerSummary}
        pagination={activePagination}
        includeSubfoldersToggle={includeSubfoldersToggle}
        headerExtra={headerExtra}
        onClose={onClose}
        closeAriaLabel={closeAriaLabel}
        fallbackAction={(
          <button type="button" onClick={onBackToPhotos}>
            {UI_TEXT.backToPhotos}
          </button>
        )}
      />

      {error ? <div className="p-6 text-center text-sm text-muted-foreground">{error}</div> : null}
      {!error && loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">{UI_TEXT.loading}</div>
      ) : null}
      {!error && !loading && rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">{noSuggestionsMessage}</div>
      ) : null}
      {!error && !loading && rows.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {rows.map((row) => (
              <article
                key={row.item.id}
                className="grid grid-cols-1 gap-3.5 rounded-lg border border-border bg-card p-3 xl:grid-cols-[minmax(220px,360px)_1fr]"
              >
                <div className="flex flex-col gap-2.5">
                  <h4 className="m-0 text-sm font-semibold text-foreground">{UI_TEXT.originalLabel}</h4>
                  <OriginalImage item={row.item} onOriginalImageClick={onOriginalImageClick} />
                  <div className="break-words text-xs text-muted-foreground">{row.item.title}</div>
                  {row.item.folderPathRelative ? (
                    <div className="break-words text-[11px] text-muted-foreground/80">
                      {row.item.folderPathRelative}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2.5">
                  <SuggestionPreview
                    title={row.item.title}
                    imageUrl={row.item.imageUrl ?? null}
                    transform={row.transform}
                    variant={variant}
                    confidence={row.item.rotationReviewMeta?.confidence ?? null}
                    saving={rotationActionState?.savingItemId === row.item.id}
                    discarding={rotationActionState?.discardingItemId === row.item.id}
                    actionError={rotationActionState?.errorByItemId?.[row.item.id]}
                    confirmation={rotationActionState?.confirmationByItemId?.[row.item.id]}
                    onRotationSave={
                      onRotationSave
                        ? (selection: RotationReviewSaveSelection) => onRotationSave(row.item, selection)
                        : undefined
                    }
                    onRotationDiscard={
                      onRotationDiscard ? () => onRotationDiscard(row.item) : undefined
                    }
                  />
                  {variant === "default" ? (
                    <>
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
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
