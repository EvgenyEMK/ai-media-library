import { useMemo, type ReactElement } from "react";
import "./image-edit-suggestions.css";
import { SuggestionPreview } from "./image-edit-suggestion-preview";
import { SuggestionSection } from "./image-edit-suggestion-section";
import type {
  ImageEditSuggestionsItem,
  ImageEditSuggestionsViewProps,
  PriorityLevel,
  PreviewTransform,
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
  previousPage: "Previous page",
  nextPage: "Next page",
} as const;

function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
}: NonNullable<ImageEditSuggestionsViewProps["pagination"]>): ReactElement | null {
  if (total <= 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(Math.max(1, page), pageCount);
  const start = (normalizedPage - 1) * pageSize + 1;
  const end = Math.min(total, normalizedPage * pageSize);
  return (
    <nav className="image-edit-pagination" aria-label="Image edit suggestions pages">
      <span>{`Showing ${start}-${end} of ${total}`}</span>
      <div>
        <button
          type="button"
          disabled={normalizedPage <= 1}
          onClick={() => onPageChange(normalizedPage - 1)}
        >
          {UI_TEXT.previousPage}
        </button>
        <span>{`Page ${normalizedPage} of ${pageCount}`}</span>
        <button
          type="button"
          disabled={normalizedPage >= pageCount}
          onClick={() => onPageChange(normalizedPage + 1)}
        >
          {UI_TEXT.nextPage}
        </button>
      </div>
    </nav>
  );
}

function OriginalImage({
  item,
  onOriginalImageClick,
}: {
  item: ImageEditSuggestionsItem;
  onOriginalImageClick?: (item: ImageEditSuggestionsItem) => void;
}): ReactElement {
  const image = <img src={item.imageUrl ?? ""} alt={item.title} />;
  if (!onOriginalImageClick) {
    return image;
  }
  return (
    <button
      type="button"
      className="image-edit-original-image-button"
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
  noSuggestionsMessage = UI_TEXT.noSuggestions,
  suggestedSummaryLabel = UI_TEXT.suggestedSummary,
  highPrioritySummaryLabel = UI_TEXT.highPrioritySummary,
  applyChangesNote,
  headerExtra,
  pagination,
  loading = false,
  error = null,
  onOriginalImageClick,
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
          <h3>{title}</h3>
          <p>
            {suggestedSummaryLabel}: {pagination?.total ?? rows.length}
            {variant === "default" ? (
              <>
                {" | "}
                {highPrioritySummaryLabel}: {highPriorityPhotoCount}
              </>
            ) : null}
          </p>
        </div>
        <div className="image-edit-header-actions">
          {headerExtra}
          <button type="button" onClick={onBackToPhotos}>
            {UI_TEXT.backToPhotos}
          </button>
        </div>
      </header>

      {error ? <div className="empty-state">{error}</div> : null}
      {!error && loading ? <div className="empty-state">{UI_TEXT.loading}</div> : null}
      {!error && !loading && rows.length === 0 ? (
        <div className="empty-state">{noSuggestionsMessage}</div>
      ) : null}
      {!error && !loading && rows.length > 0 ? (
        <>
          {pagination ? <PaginationControls {...pagination} /> : null}
          <div className="image-edit-suggestions-rows">
            {rows.map((row) => (
              <article key={row.item.id} className="image-edit-row">
                <div className="image-edit-original-column">
                  <h4>{UI_TEXT.originalLabel}</h4>
                  <OriginalImage item={row.item} onOriginalImageClick={onOriginalImageClick} />
                  <div className="image-edit-photo-title">{row.item.title}</div>
                  {row.item.folderPathRelative ? (
                    <div className="image-edit-folder-path">{row.item.folderPathRelative}</div>
                  ) : null}
                </div>
                <div className="image-edit-details-column">
                  <SuggestionPreview
                    title={row.item.title}
                    imageUrl={row.item.imageUrl ?? null}
                    transform={row.transform}
                    applyChangesNote={applyChangesNote}
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
          {pagination ? <PaginationControls {...pagination} /> : null}
        </>
      ) : null}
    </section>
  );
}
