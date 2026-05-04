import { type ReactElement } from "react";
import type { SmartAlbumYearAreaSubView } from "@emk/shared-contracts";
import { cn } from "../../lib/cn";

const SEGMENT_TEXT = "text-lg font-semibold leading-snug";

const LABEL_BY_VIEW: Record<SmartAlbumYearAreaSubView, string> = {
  "month-area": "Country > YYYY-MM Area",
  "year-area": "Country > YYYY Area",
  "year-city": "Country > Year > Area",
};

const SUBVIEW_ORDER: readonly SmartAlbumYearAreaSubView[] = ["month-area", "year-area", "year-city"];

export function SmartAlbumYearAreaSubviewBar({
  subView,
  onSubViewChange,
}: {
  subView: SmartAlbumYearAreaSubView;
  onSubViewChange: (next: SmartAlbumYearAreaSubView) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md border border-border bg-card/60 px-3 py-2">
      {SUBVIEW_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            if (key !== subView) {
              onSubViewChange(key);
            }
          }}
          className={cn(
            SEGMENT_TEXT,
            "rounded px-1.5 py-0.5",
            subView === key
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground/80 hover:bg-muted",
          )}
          aria-pressed={subView === key}
        >
          {LABEL_BY_VIEW[key]}
        </button>
      ))}
    </div>
  );
}
