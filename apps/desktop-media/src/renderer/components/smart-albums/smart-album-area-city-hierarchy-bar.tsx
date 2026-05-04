import { type ReactElement } from "react";
import { cn } from "../../lib/cn";
import {
  formatHierarchySegmentLabel,
  toggleSmartPlaceHierarchyLevel,
  type SmartPlaceHierarchyLevels,
} from "../../lib/smart-place-hierarchy";

const HIERARCHY_SEGMENT_TEXT = "text-lg font-semibold leading-snug";

export function SmartAlbumAreaCityHierarchyBar({
  levels,
  onLevelsChange,
}: {
  levels: SmartPlaceHierarchyLevels;
  onLevelsChange: (next: SmartPlaceHierarchyLevels) => void;
}): ReactElement {
  const onToggle = (key: "area1" | "area2" | "city"): void => {
    const next = toggleSmartPlaceHierarchyLevel(levels, key);
    if (next) {
      onLevelsChange(next);
    }
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 rounded-md border border-border bg-card/60 px-3 py-2">
      <span className={cn(HIERARCHY_SEGMENT_TEXT, "text-foreground")}>
        {formatHierarchySegmentLabel("country")}
      </span>
      {(["area1", "area2", "city"] as const).map((key) => (
        <span key={key} className="inline-flex items-baseline gap-x-1">
          <span className={cn(HIERARCHY_SEGMENT_TEXT, "text-muted-foreground/80")}>&gt;</span>
          <button
            type="button"
            onClick={() => onToggle(key)}
            className={cn(
              HIERARCHY_SEGMENT_TEXT,
              "rounded px-1.5 py-0.5",
              levels[key]
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground/80 hover:bg-muted",
            )}
            aria-pressed={levels[key]}
          >
            {formatHierarchySegmentLabel(key)}
          </button>
        </span>
      ))}
    </div>
  );
}
