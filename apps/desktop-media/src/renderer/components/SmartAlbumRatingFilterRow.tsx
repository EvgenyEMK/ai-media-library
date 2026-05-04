import { type ReactElement } from "react";
import { MediaItemStarRating } from "@emk/media-viewer";

export type RatingOperator = "gte" | "eq";

export function aiRatingStarsToAestheticMin(stars: number): number | undefined {
  if (!Number.isFinite(stars) || stars < 1) {
    return undefined;
  }
  return Math.min(10, Math.max(1, (Math.trunc(stars) - 1) * 2 + 1));
}

export function aestheticMinToAiRatingStars(value: number | undefined): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(5, Math.max(1, Math.ceil((value ?? 0) / 2)));
}

export function SmartAlbumRatingFilterRow({
  label,
  value,
  operator,
  onOperatorChange,
  onChange,
}: {
  label: string;
  value: number | null;
  operator: RatingOperator;
  onOperatorChange: (next: RatingOperator) => void;
  onChange: (next: number | null) => void;
}): ReactElement {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-1 gap-y-1 text-ai-search-muted">
      <span className="shrink-0 text-sm font-medium text-ai-search-text/90">{label}</span>
      <button
        type="button"
        className="inline-flex h-8 min-w-7 shrink-0 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control px-0.5 text-sm font-semibold tabular-nums text-ai-search-text hover:bg-ai-search-control/80"
        onClick={() => onOperatorChange(operator === "gte" ? "eq" : "gte")}
        aria-label={`${label} operator`}
        title="Click to switch between ≥ and ="
      >
        {operator === "gte" ? "≥" : "="}
      </button>
      <div className="ml-2 flex min-w-0 items-center">
      <MediaItemStarRating
        starRating={value}
        onChange={(next) => onChange(next > 0 ? next : null)}
        expanded
        tone="onCard"
      />
      </div>
    </div>
  );
}
