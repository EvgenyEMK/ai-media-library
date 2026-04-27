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
    <div className="grid min-h-9 grid-cols-[4.75rem_3.25rem_auto] items-center gap-2 text-xs text-ai-search-muted">
      <span className="text-ai-search-text/90">{label}</span>
      <button
        type="button"
        className="inline-flex h-8 min-w-11 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control px-2 text-xs font-semibold text-ai-search-text hover:bg-ai-search-control/80"
        onClick={() => onOperatorChange(operator === "gte" ? "eq" : "gte")}
        aria-label={`${label} operator`}
        title="Click to switch between >= and ="
      >
        {operator === "gte" ? ">=" : "="}
      </button>
      <MediaItemStarRating
        starRating={value}
        onChange={(next) => onChange(next > 0 ? next : null)}
        expanded
        tone="onCard"
      />
    </div>
  );
}
