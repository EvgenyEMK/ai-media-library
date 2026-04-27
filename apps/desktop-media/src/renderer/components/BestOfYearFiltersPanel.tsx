import { type ReactElement } from "react";
import { X } from "lucide-react";
import type { SmartAlbumFilters } from "@emk/shared-contracts";
import type { PersonTagListMeta } from "../lib/tagged-faces-tab-visible-tags";
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
  onClear,
  onFiltersChange,
  onTogglePersonTag,
}: {
  filters: SmartAlbumFilters;
  personTags: PersonTagListMeta[];
  onClear: () => void;
  onFiltersChange: (updater: (current: SmartAlbumFilters) => SmartAlbumFilters) => void;
  onTogglePersonTag: (tagId: string) => void;
}): ReactElement {
  const selectedPersonTagIds = filters.personTagIds ?? [];
  const includeUnconfirmedFaces = filters.includeUnconfirmedFaces === true;

  return (
    <section className="shrink-0 border-b border-ai-search-border bg-ai-search-panel px-4 py-2.5 text-ai-search-text">
      <div className="flex w-full flex-nowrap items-center gap-2">
        <Input
          value={filters.query ?? ""}
          onChange={(event) => onFiltersChange((current) => ({ ...current, query: event.target.value }))}
          placeholder="AI search prompt (optional)"
          className="h-9 min-w-0 flex-1 border-ai-search-border bg-ai-search-control text-ai-search-text placeholder:text-ai-search-muted/75"
        />
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control text-ai-search-text hover:bg-ai-search-control/80"
          onClick={onClear}
          aria-label="Clear filters"
          title="Clear filters"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
        <SmartAlbumRatingFilterRow
          label="Rating"
          value={filters.starRatingMin ?? null}
          operator={filters.starRatingOperator === "eq" ? "eq" : "gte"}
          onOperatorChange={(next) => onFiltersChange((current) => ({ ...current, starRatingOperator: next }))}
          onChange={(next) => onFiltersChange((current) => ({ ...current, starRatingMin: next ?? undefined }))}
        />
        <div className="text-xs font-semibold text-ai-search-muted">OR</div>
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
