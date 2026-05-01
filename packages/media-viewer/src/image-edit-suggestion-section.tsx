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
    <section className="image-edit-suggestions-section">
      <h4>{title}</h4>
      <ul className="image-edit-suggestions-list">
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
            <li key={`${suggestion.editType}-${index}`} className="image-edit-suggestion-item">
              <div className="image-edit-suggestion-heading">
                <strong>{editTypeLabel}</strong>
                <span className={`image-edit-priority-chip priority-${priority}`}>
                  {priority === "unknown" ? "Unspecified" : `${toHeadlineLabel(priority)} priority`}
                </span>
              </div>
              {rotationDegrees !== null ? (
                <p>{`Clockwise rotation: ${rotationDegrees}\u00b0`}</p>
              ) : null}
              {reason ? <p>{reason}</p> : null}
              {previewSuggestionIndexes.has(index) ? (
                <div className="image-edit-suggestion-preview-flag">{UI_TEXT.shownInPreview}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
