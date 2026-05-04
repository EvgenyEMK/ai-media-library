import { type ReactElement } from "react";
import type { SmartAlbumYearSummary } from "@emk/shared-contracts";
import { toFileUrl } from "../face-cluster-utils";
import type { ActiveSmartAlbum } from "../useSmartAlbums";

export function SmartAlbumBestOfYearCards({
  years,
  onActiveSmartAlbumChange,
}: {
  years: SmartAlbumYearSummary[];
  onActiveSmartAlbumChange: (album: ActiveSmartAlbum) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {years.map((year) => (
        <button
          key={year.year}
          type="button"
          onClick={() =>
            onActiveSmartAlbumChange({
              kind: "best-of-year",
              year: year.year,
            })
          }
          className="overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm hover:bg-muted/50"
        >
          <div className="relative aspect-video w-full overflow-hidden">
            {year.coverSourcePath ? (
              <img
                src={toFileUrl(year.coverSourcePath)}
                alt={`Best of ${year.year}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="text-5xl font-extrabold tracking-wide text-white drop-shadow-md">
                {year.year}
              </span>
            </div>
          </div>
          <div className="space-y-1 p-3">
            <p className="text-sm text-muted-foreground">{year.mediaCount} items</p>
            <p className="text-xs text-muted-foreground">
              Items with rating {year.manualRatedCount} / {year.aiRatedCount} (manual / AI)
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
