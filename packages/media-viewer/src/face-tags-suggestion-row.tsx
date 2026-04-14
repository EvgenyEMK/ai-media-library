"use client";

import type { ReactElement } from "react";

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface FaceTagPersonSuggestionRowProps {
  tagLabel: string;
  /** Cosine similarity in 0–1: this face vs the person’s embedding centroid (not detection confidence). */
  similarityScore: number;
  onAssign: () => void;
  disabled?: boolean;
  assignButtonClassName?: string;
  metricsClassName?: string;
}

/**
 * One-click assign for embedding-based person guess + similarity percentage.
 */
export function FaceTagPersonSuggestionRow({
  tagLabel,
  similarityScore,
  onAssign,
  disabled,
  assignButtonClassName,
  metricsClassName,
}: FaceTagPersonSuggestionRowProps): ReactElement {
  const pctLabel = `${(clamp01(similarityScore) * 100).toFixed(1)}%`;
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        title={`${pctLabel} similar (face embedding vs ${tagLabel}'s person centroid). Click to assign.`}
        className={
          assignButtonClassName ??
          joinClasses(
            "inline-flex h-8 max-w-[200px] shrink-0 items-center truncate rounded-md border border-border",
            "bg-secondary/80 px-2 font-medium text-foreground hover:bg-muted disabled:opacity-50",
          )
        }
        onClick={(event) => {
          event.stopPropagation();
          onAssign();
        }}
      >
        {tagLabel} ?
      </button>
      <span className={metricsClassName ?? "tabular-nums"}>Similarity: {pctLabel}</span>
    </div>
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
