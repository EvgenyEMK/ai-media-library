import { type ReactElement } from "react";
import { MediaItemStarRating } from "@emk/media-viewer";
import { useMediaItemStarRatingChange } from "../hooks/use-media-item-star-rating-change";

const RATING_LABEL = "Rating";

interface DesktopViewerInfoRatingRowProps {
  sourcePath: string;
  starRating: number | null | undefined;
}

export function DesktopViewerInfoRatingRow({
  sourcePath,
  starRating,
}: DesktopViewerInfoRatingRowProps): ReactElement {
  const setStarRating = useMediaItemStarRatingChange();

  const onChange = (next: number): void => {
    void setStarRating(sourcePath, next);
  };

  return (
    <div className="flex min-h-[40px] items-center gap-3 border-b border-border py-2.5">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{RATING_LABEL}</span>
      <div
        className="flex min-h-[28px] min-w-0 flex-1 items-center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MediaItemStarRating
          starRating={starRating ?? null}
          onChange={onChange}
          showRejectedIndicator
          expanded
          tone="onCard"
        />
      </div>
    </div>
  );
}
