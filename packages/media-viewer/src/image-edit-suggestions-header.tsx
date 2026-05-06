import type { ReactElement, ReactNode } from "react";
import type { ImageEditSuggestionsPagination } from "./image-edit-suggestions-types";

const UI_TEXT = {
  previousPage: "Previous page",
  nextPage: "Next page",
  close: "Close",
} as const;

function ChevronLeftIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon(): ReactElement {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeaderPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: ImageEditSuggestionsPagination): ReactElement | null {
  if (total <= 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(Math.max(1, page), pageCount);

  return (
    <nav
      className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground"
      aria-label="Image edit suggestions pages"
    >
      <span>{`Page ${normalizedPage} of ${pageCount}`}</span>
      <button
        type="button"
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-muted p-0 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45"
        disabled={normalizedPage <= 1}
        onClick={() => onPageChange(normalizedPage - 1)}
        title={UI_TEXT.previousPage}
        aria-label={UI_TEXT.previousPage}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-muted p-0 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45"
        disabled={normalizedPage >= pageCount}
        onClick={() => onPageChange(normalizedPage + 1)}
        title={UI_TEXT.nextPage}
        aria-label={UI_TEXT.nextPage}
      >
        <ChevronRightIcon />
      </button>
    </nav>
  );
}

export function ImageEditSuggestionsHeader({
  title,
  titleSuffix,
  summary,
  pagination,
  includeSubfoldersToggle,
  headerExtra,
  onClose,
  closeAriaLabel = UI_TEXT.close,
  fallbackAction,
}: {
  title: string;
  /** Appended as ` - {suffix}` with normal font weight (title stays semibold). */
  titleSuffix?: string | null;
  summary: string | null;
  pagination?: ImageEditSuggestionsPagination;
  includeSubfoldersToggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  };
  headerExtra?: ReactNode;
  onClose?: () => void;
  closeAriaLabel?: string;
  fallbackAction: ReactElement;
}): ReactElement {
  const fullTitle = titleSuffix?.trim() ? `${title} - ${titleSuffix.trim()}` : title;
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-b-lg border border-border bg-card px-3.5 py-3 max-lg:flex-col max-lg:items-start">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3
          className="m-0 min-w-0 max-w-full truncate text-base text-foreground"
          title={fullTitle}
        >
          {titleSuffix?.trim() ? (
            <>
              <span className="font-semibold">{title}</span>
              <span className="font-normal">{` - ${titleSuffix.trim()}`}</span>
            </>
          ) : (
            <span className="font-semibold">{title}</span>
          )}
        </h3>
        {includeSubfoldersToggle ? (
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeSubfoldersToggle.checked}
              onChange={(event) => includeSubfoldersToggle.onChange(event.currentTarget.checked)}
            />
            <span>{includeSubfoldersToggle.label}</span>
          </label>
        ) : null}
        {summary ? <p className="m-0 text-sm text-muted-foreground">{summary}</p> : null}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3 max-lg:ml-0 max-lg:justify-start">
        {headerExtra}
        {pagination ? <HeaderPagination {...pagination} /> : null}
        {onClose ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-muted p-0 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onClose}
            title={closeAriaLabel}
            aria-label={closeAriaLabel}
          >
            <CloseIcon />
          </button>
        ) : (
          fallbackAction
        )}
      </div>
    </header>
  );
}
