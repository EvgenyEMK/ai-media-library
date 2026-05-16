import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react";
import { X } from "lucide-react";
import { normalizeAlbumDateBounds, type SmartAlbumFilters } from "@emk/shared-contracts";
import type { PersonTagListMeta } from "../lib/tagged-faces-tab-visible-tags";
import { albumFilterActiveInputClasses } from "../lib/album-filter-active-styles";
import {
  ALBUM_LIST_LOCATION_INPUT_MAX_CLASS,
  ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS,
} from "../lib/album-list-search-ui";
import { SMART_ALBUM_AI_SEARCH_QUERY_DEBOUNCE_MS } from "../lib/smart-album-search-ui";
import { cn } from "../lib/cn";
import { Input } from "./ui/input";
import { SemanticSearchPersonTagsBar } from "./semantic-search-person-tags-bar";
import {
  aestheticMinToAiRatingStars,
  aiRatingStarsToAestheticMin,
  SmartAlbumRatingFilterRow,
} from "./SmartAlbumRatingFilterRow";
import {
  ALBUM_YEAR_MONTH_INPUT_HINT,
  ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER,
  ALBUM_YEAR_MONTH_INPUT_WIDTH_CLASS,
  sanitizeAlbumYearMonthDigitsInput,
} from "../lib/album-year-month-input";

const MAX_BEST_OF_PERSON_TAGS = 20;

export function BestOfPersonPeopleFiltersPanel({
  filters,
  selectedPersonTagIds,
  personTags,
  resetKey,
  onClose,
  onClear,
  onFiltersChange,
  onTogglePersonTag,
}: {
  filters: SmartAlbumFilters;
  selectedPersonTagIds: readonly string[];
  personTags: PersonTagListMeta[];
  /** Increment to reset local draft fields (e.g. after Clear filters). */
  resetKey: number;
  onClose: () => void;
  onClear: () => void;
  onFiltersChange: (updater: (current: SmartAlbumFilters) => SmartAlbumFilters) => void;
  onTogglePersonTag: (tagId: string) => void;
}): ReactElement {
  const includeUnconfirmedFaces = filters.includeUnconfirmedFaces === true;
  const canToggleUnconfirmed = selectedPersonTagIds.length > 0;

  const [draftQuery, setDraftQuery] = useState(() => filters.query ?? "");
  const [locationDraft, setLocationDraft] = useState(() => filters.locationQuery ?? "");
  const [yearMonthFromDraft, setYearMonthFromDraft] = useState("");
  const [yearMonthToDraft, setYearMonthToDraft] = useState("");
  const [showDateRangeHint, setShowDateRangeHint] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const draftTrimmed = draftQuery.trim();
  const queryCommittedTrimmed = (filters.query ?? "").trim();
  const aiPromptActive = draftTrimmed.length > 0 || queryCommittedTrimmed.length > 0;
  const showPromptClear = draftTrimmed.length > 0;

  const locationDraftTrimmed = locationDraft.trim();
  const locationCommittedTrimmed = (filters.locationQuery ?? "").trim();
  const locationActive =
    locationDraftTrimmed.length > 0 || locationCommittedTrimmed.length > 0;

  useEffect(() => {
    setDraftQuery(filters.query ?? "");
    setLocationDraft(filters.locationQuery ?? "");
  }, [filters.query, filters.locationQuery, resetKey]);

  useEffect(() => {
    setYearMonthFromDraft("");
    setYearMonthToDraft("");
  }, [resetKey]);

  useEffect(() => {
    const hiddenFiltersActive =
      (filters.query ?? "").trim().length > 0 ||
      (filters.locationQuery ?? "").trim().length > 0 ||
      Boolean(filters.dateFrom?.trim()) ||
      Boolean(filters.dateTo?.trim()) ||
      yearMonthFromDraft.trim().length > 0 ||
      yearMonthToDraft.trim().length > 0;
    if (hiddenFiltersActive) {
      setShowMoreFilters(true);
    }
  }, [
    filters.query,
    filters.locationQuery,
    filters.dateFrom,
    filters.dateTo,
    yearMonthFromDraft,
    yearMonthToDraft,
  ]);

  useEffect(() => {
    const trimmed = draftQuery.trim();
    const nextCommitted = trimmed.length === 0 ? undefined : draftQuery;
    const handle = window.setTimeout(() => {
      onFiltersChange((prev) => {
        if (prev.query === nextCommitted) {
          return prev;
        }
        return { ...prev, query: nextCommitted };
      });
    }, SMART_ALBUM_AI_SEARCH_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, onFiltersChange]);

  useEffect(() => {
    const trimmed = locationDraft.trim();
    const nextCommitted = trimmed.length === 0 ? undefined : locationDraft;
    const handle = window.setTimeout(() => {
      onFiltersChange((prev) => {
        const prevTrimmed = (prev.locationQuery ?? "").trim();
        if (prevTrimmed === trimmed) {
          return prev;
        }
        return { ...prev, locationQuery: nextCommitted };
      });
    }, ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [locationDraft, onFiltersChange]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const bounds = normalizeAlbumDateBounds({
        yearMonthFrom: yearMonthFromDraft,
        yearMonthTo: yearMonthToDraft,
      });
      onFiltersChange((prev) => {
        const nextFrom = bounds.start;
        const nextTo = bounds.end;
        if (prev.dateFrom === nextFrom && prev.dateTo === nextTo) {
          return prev;
        }
        return { ...prev, dateFrom: nextFrom, dateTo: nextTo };
      });
    }, ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [yearMonthFromDraft, yearMonthToDraft, onFiltersChange]);

  const clearAiPrompt = (): void => {
    setDraftQuery("");
    onFiltersChange((current) => ({ ...current, query: undefined }));
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearAiPrompt();
    }
  };

  const dateRangeShellRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      setShowDateRangeHint(false);
      return undefined;
    }
    const onFocusIn = (): void => {
      setShowDateRangeHint(true);
    };
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget as Node | null;
      if (!next || !el.contains(next)) {
        setShowDateRangeHint(false);
      }
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return (): void => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const handleToggleTag = (tagId: string): void => {
    if (!selectedPersonTagIds.includes(tagId) && selectedPersonTagIds.length >= MAX_BEST_OF_PERSON_TAGS) {
      return;
    }
    onTogglePersonTag(tagId);
  };

  return (
    <section className="shrink-0 border-b border-ai-search-border bg-ai-search-panel px-4 py-2.5 text-ai-search-text">
      <div className="flex w-full min-w-0 flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 w-max max-w-full flex-col gap-2">
          {showMoreFilters ? (
            <div className="flex w-full min-w-0 flex-wrap items-start gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-[min(100%,18rem)]">
                <span className="mb-1 block text-xs font-medium text-ai-search-muted">AI search prompt (optional)</span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <Input
                    value={draftQuery}
                    onChange={(event) => setDraftQuery(event.target.value)}
                    onKeyDown={handlePromptKeyDown}
                    placeholder="AI search prompt (optional)"
                    className={cn(
                      "h-9 min-w-0 w-full border-ai-search-border bg-ai-search-control text-ai-search-text placeholder:text-ai-search-muted/75",
                      aiPromptActive
                        ? albumFilterActiveInputClasses
                        : "focus-visible:border-ai-search-accent focus-visible:ring-ai-search-accent/45",
                    )}
                  />
                  {showPromptClear ? (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-1 text-ai-search-text hover:bg-ai-search-control/60"
                      onClick={clearAiPrompt}
                      aria-label="Clear AI search prompt"
                      title="Clear AI search prompt"
                    >
                      <X size={22} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
              <label className={`grid min-w-0 gap-1 ${ALBUM_LIST_LOCATION_INPUT_MAX_CLASS}`}>
                <span className="text-xs font-medium text-ai-search-muted">Location</span>
                <Input
                  value={locationDraft}
                  onChange={(event) => setLocationDraft(event.target.value)}
                  placeholder="Country, area, or city"
                  className={cn(
                    "h-9 border-ai-search-border bg-ai-search-control text-ai-search-text placeholder:text-ai-search-muted/75",
                    locationActive
                      ? albumFilterActiveInputClasses
                      : "focus-visible:border-ai-search-accent focus-visible:ring-ai-search-accent/45",
                  )}
                />
              </label>
              <div ref={dateRangeShellRef} className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-start gap-3">
                  <label className="grid w-fit max-w-full gap-1">
                    <span className="text-xs font-medium text-ai-search-muted">From</span>
                    <Input
                      value={yearMonthFromDraft}
                      onChange={(event) =>
                        setYearMonthFromDraft(sanitizeAlbumYearMonthDigitsInput(event.target.value))
                      }
                      placeholder={ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER}
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      className={cn(
                        `${ALBUM_YEAR_MONTH_INPUT_WIDTH_CLASS} border-ai-search-border bg-ai-search-control font-mono text-sm tabular-nums text-ai-search-text placeholder:text-ai-search-muted/75`,
                        yearMonthFromDraft.trim() || (filters.dateFrom ?? "").trim()
                          ? albumFilterActiveInputClasses
                          : "focus-visible:border-ai-search-accent focus-visible:ring-ai-search-accent/45",
                      )}
                    />
                  </label>
                  <label className="grid w-fit max-w-full gap-1">
                    <span className="text-xs font-medium text-ai-search-muted">To</span>
                    <Input
                      value={yearMonthToDraft}
                      onChange={(event) =>
                        setYearMonthToDraft(sanitizeAlbumYearMonthDigitsInput(event.target.value))
                      }
                      placeholder={ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER}
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      className={cn(
                        `${ALBUM_YEAR_MONTH_INPUT_WIDTH_CLASS} border-ai-search-border bg-ai-search-control font-mono text-sm tabular-nums text-ai-search-text placeholder:text-ai-search-muted/75`,
                        yearMonthToDraft.trim() || (filters.dateTo ?? "").trim()
                          ? albumFilterActiveInputClasses
                          : "focus-visible:border-ai-search-accent focus-visible:ring-ai-search-accent/45",
                      )}
                    />
                  </label>
                </div>
                <p
                  className={`min-h-[1.25rem] text-xs text-ai-search-muted ${
                    showDateRangeHint ? "" : "invisible"
                  }`}
                  aria-hidden={!showDateRangeHint}
                >
                  {ALBUM_YEAR_MONTH_INPUT_HINT}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-y-1">
            <SmartAlbumRatingFilterRow
              label="Rating"
              value={filters.starRatingMin ?? null}
              operator={filters.starRatingOperator === "eq" ? "eq" : "gte"}
              onOperatorChange={(next) => onFiltersChange((current) => ({ ...current, starRatingOperator: next }))}
              onChange={(next) => onFiltersChange((current) => ({ ...current, starRatingMin: next ?? undefined }))}
            />
            <span className="mx-4 shrink-0 text-xs font-semibold text-ai-search-muted">OR</span>
            <SmartAlbumRatingFilterRow
              label="AI rating"
              value={aestheticMinToAiRatingStars(filters.aiAestheticMin)}
              operator={filters.aiAestheticOperator === "eq" ? "eq" : "gte"}
              onOperatorChange={(next) => onFiltersChange((current) => ({ ...current, aiAestheticOperator: next }))}
              onChange={(next) =>
                onFiltersChange((current) => ({
                  ...current,
                  aiAestheticMin: next ? aiRatingStarsToAestheticMin(next) : undefined,
                }))
              }
            />
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-ai-search-border bg-ai-search-control px-2.5 py-1.5 text-sm font-medium text-ai-search-text hover:bg-ai-search-control/80"
            onClick={() => setShowMoreFilters((open) => !open)}
            aria-expanded={showMoreFilters}
          >
            {showMoreFilters ? "Less filters" : "More filters"}
          </button>
          <button
            type="button"
            className="rounded-md border border-ai-search-border bg-ai-search-control px-2.5 py-1.5 text-sm font-medium text-ai-search-text hover:bg-ai-search-control/80"
            onClick={onClear}
          >
            Clear filters
          </button>
          <button
            type="button"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control text-ai-search-text hover:bg-ai-search-control/80"
            onClick={onClose}
            aria-label="Close search inputs"
            title="Close search inputs"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2">
        <SemanticSearchPersonTagsBar
          tagsMeta={personTags}
          selectedTagIds={selectedPersonTagIds}
          onToggleTag={handleToggleTag}
        />
        <label
          className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-ai-search-text/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          title={!canToggleUnconfirmed ? "Select at least one person tag" : undefined}
        >
          <input
            type="checkbox"
            className="cursor-pointer accent-ai-search-accent"
            checked={includeUnconfirmedFaces}
            disabled={!canToggleUnconfirmed}
            onChange={(event) =>
              onFiltersChange((current) => ({
                ...current,
                includeUnconfirmedFaces: event.target.checked,
              }))
            }
          />
          <span>Include unconfirmed similar faces</span>
        </label>
      </div>
    </section>
  );
}
