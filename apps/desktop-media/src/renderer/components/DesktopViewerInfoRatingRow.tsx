import { type ReactElement } from "react";
import { MediaItemStarRating } from "@emk/media-viewer";
import { useMediaItemStarRatingChange } from "../hooks/use-media-item-star-rating-change";

interface DesktopViewerInfoRatingRowProps {
  sourcePath: string;
  starRating: number | null | undefined;
  leftContent?: ReactElement | null;
  belowRowContent?: ReactElement | null;
}

export function DesktopViewerInfoRatingRow({
  sourcePath,
  starRating,
  leftContent = null,
  belowRowContent = null,
}: DesktopViewerInfoRatingRowProps): ReactElement {
  const setStarRating = useMediaItemStarRatingChange();

  const onChange = (next: number): void => {
    void setStarRating(sourcePath, next);
  };

  return (
    <div className="border-b border-border py-2.5">
      <div className="flex min-h-[40px] items-center justify-between gap-3">
        <div className="min-w-0">{leftContent}</div>
        <div
          className="flex min-h-[28px] shrink-0 items-center"
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
      {belowRowContent ? <div className="pt-1">{belowRowContent}</div> : null}
    </div>
  );
}
