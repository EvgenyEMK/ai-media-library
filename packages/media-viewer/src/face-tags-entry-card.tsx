"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface FaceTagsEntryCardProps {
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  controls: ReactNode;
  /** Shown directly under the main controls row (e.g. person-tag suggestion + similarity). */
  suggestionRow?: ReactNode;
  badges?: ReactNode;
  details?: ReactNode;
  thumbnailStyle?: CSSProperties | null;
}

export function FaceTagsEntryCard({
  index,
  isSelected,
  onSelect,
  controls,
  suggestionRow,
  badges,
  details,
  thumbnailStyle,
}: FaceTagsEntryCardProps): ReactElement {
  return (
    <div
      onClick={() => onSelect(index)}
      className={joinClasses(
        "rounded-lg border p-4 transition-colors",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <div className="flex gap-3">
        {thumbnailStyle ? (
          <div
            className="size-[5.25rem] shrink-0 rounded-md bg-muted"
            style={thumbnailStyle}
            role="img"
            aria-label={`Face #${index + 1}`}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {controls}
          {suggestionRow}
          {badges}
          {details}
        </div>
      </div>
    </div>
  );
}
