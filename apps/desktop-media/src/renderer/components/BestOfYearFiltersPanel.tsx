import { type KeyboardEvent, type ReactElement, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { SmartAlbumFilters } from "@emk/shared-contracts";
import type { PersonTagListMeta } from "../lib/tagged-faces-tab-visible-tags";
import { SMART_ALBUM_AI_SEARCH_QUERY_DEBOUNCE_MS } from "../lib/smart-album-search-ui";
import { Input } from "./ui/input";
import { SemanticSearchPersonTagsBar } from "./semantic-search-person-tags-bar";
import {
  aestheticMinToAiRatingStars,
  aiRatingStarsToAestheticMin,
  SmartAlbumRatingFilterRow,
} from "./SmartAlbumRatingFilterRow";

export function BestOfYearFiltersPanel({
  filters,
  personTags,
  onClose,
  onClear,
  onFiltersChange,
  onTogglePersonTag,
}: {
  filters: SmartAlbumFilters;
  personTags: PersonTagListMeta[];
  onClose: () => void;
  onClear: () => void;
  onFiltersChange: (updater: (current: SmartAlbumFilters) => SmartAlbumFilters) => void;
  onTogglePersonTag: (tagId: string) => void;
}): ReactElement {
  const selectedPersonTagIds = filters.personTagIds ?? [];
  const includeUnconfirmedFaces = filters.includeUnconfirmedFaces === true;
  const [draftQuery, setDraftQuery] = useState(() => filters.query ?? "");
  const draftTrimmed = draftQuery.trim();
  const showPromptClear = draftTrimmed.length > 0;

  useEffect(() => {
    setDraftQuery(filters.query ?? "");
  }, [filters.query]);

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

  return (
    <section className="shrink-0 border-b border-ai-search-border bg-ai-search-panel px-4 py-2.5 text-ai-search-text">
      <div className="flex w-full min-w-0 flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 w-max max-w-full flex-col gap-2">
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <div className="min-w-0 flex-1 [&_input]:border-ai-search-border [&_input]:bg-ai-search-control [&_input]:text-ai-search-text [&_input]:placeholder:text-ai-search-muted/75 [&_input]:focus:border-ai-search-accent [&_input]:focus:ring-ai-search-accent/45">
              <Input
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="AI search prompt (optional)"
                className="h-9 min-w-0 w-full"
              />
            </div>
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
        <div className="ml-auto flex shrink-0 gap-2">
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
          onToggleTag={onTogglePersonTag}
        />
        <label
          className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-ai-search-text/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          title={selectedPersonTagIds.length === 0 ? "Select at least one person tag" : undefined}
        >
          <input
            type="checkbox"
            className="cursor-pointer accent-ai-search-accent"
            checked={includeUnconfirmedFaces}
            disabled={selectedPersonTagIds.length === 0}
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
