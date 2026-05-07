import { toHeadlineLabel } from "@emk/shared-contracts";
import type { ReactElement } from "react";
import type { ImageEditSuggestion } from "./image-edit-suggestions-types";
import { getPriorityLevel } from "./image-edit-suggestions-utils";

const UI_TEXT = {
  shownInPreview: "Shown in preview",
} as const;

export function SuggestionSection({
  title,
  items,
  previewSuggestionIndexes,
}: {
  title: string;
  items: Array<{ suggestion: ImageEditSuggestion; index: number }>;
  previewSuggestionIndexes: Set<number>;
}): ReactElement | null {
  const visibleItems = items.filter(
    ({ suggestion }) => suggestion.editType !== "rotate" && suggestion.editType !== "crop",
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-border bg-card p-2.5">
      <h4 className="m-0 text-sm font-semibold text-foreground">{title}</h4>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {visibleItems.map(({ suggestion, index }) => {
          const priority = getPriorityLevel(suggestion.priority);
          const editTypeLabel = toHeadlineLabel(suggestion.editType);
          const reason = typeof suggestion.reason === "string" ? suggestion.reason.trim() : "";
          const rotationDegrees =
            suggestion.editType === "rotate" &&
            (suggestion.rotationAngleClockwise === 90 ||
              suggestion.rotationAngleClockwise === 180 ||
              suggestion.rotationAngleClockwise === 270)
              ? suggestion.rotationAngleClockwise
              : null;
          return (
            <li
              key={`${suggestion.editType}-${index}`}
              className="rounded-md border border-border bg-background p-2.5"
            >
              <div className="flex items-center justify-between gap-2.5">
                <strong>{editTypeLabel}</strong>
                <span
                  className={
                    priority === "high"
                      ? "whitespace-nowrap rounded-full border border-warning/60 bg-warning/15 px-2 py-0.5 text-[11px] text-warning"
                      : "whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  }
                >
                  {priority === "unknown" ? "Unspecified" : `${toHeadlineLabel(priority)} priority`}
                </span>
              </div>
              {rotationDegrees !== null ? (
                <p className="m-0 mt-1.5 text-sm text-foreground">{`Clockwise rotation: ${rotationDegrees}\u00b0`}</p>
              ) : null}
              {reason ? <p className="m-0 mt-1.5 text-sm text-foreground">{reason}</p> : null}
              {previewSuggestionIndexes.has(index) ? (
                <div className="mt-1.5 text-[11px] text-primary">{UI_TEXT.shownInPreview}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
