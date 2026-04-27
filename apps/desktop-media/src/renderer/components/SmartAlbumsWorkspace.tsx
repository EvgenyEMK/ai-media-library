import { type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  AlbumMediaItem,
  SmartAlbumPlaceCountry,
  SmartAlbumPlacesRequest,
  SmartAlbumYearSummary,
} from "@emk/shared-contracts";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import { DesktopAlbumContentGrid } from "./DesktopAlbumContentGrid";
import { toFileUrl } from "./face-cluster-utils";
import type { ActiveSmartAlbum } from "./useSmartAlbums";

export function SmartAlbumsWorkspace({
  isLoading,
  activeSmartAlbum,
  smartPlaceRequest,
  smartPlaceCountries,
  smartYears,
  expandedSmartCountries,
  expandedSmartGroups,
  smartPlaceGroupLabel,
  smartPlaceEntryLabel,
  smartItems,
  smartItemsPage,
  smartItemsTotal,
  quickFilters,
  viewMode,
  store,
  onToggleCountry,
  onToggleGroup,
  onActiveSmartAlbumChange,
  onSmartItemsPageChange,
}: {
  isLoading: boolean;
  activeSmartAlbum: ActiveSmartAlbum;
  smartPlaceRequest: SmartAlbumPlacesRequest | null;
  smartPlaceCountries: SmartAlbumPlaceCountry[];
  smartYears: SmartAlbumYearSummary[];
  expandedSmartCountries: string[];
  expandedSmartGroups: string[];
  smartPlaceGroupLabel: string;
  smartPlaceEntryLabel: string;
  smartItems: AlbumMediaItem[];
  smartItemsPage: number;
  smartItemsTotal: number;
  quickFilters: ThumbnailQuickFilterState;
  viewMode: DesktopStoreState["viewMode"];
  store: DesktopStore;
  onToggleCountry: (country: string) => void;
  onToggleGroup: (country: string, group: string) => void;
  onActiveSmartAlbumChange: (album: ActiveSmartAlbum) => void;
  onSmartItemsPageChange: (page: number) => void;
}): ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {isLoading ? <div className="text-sm text-muted-foreground">Loading smart albums...</div> : null}
      {!activeSmartAlbum ? (
        smartPlaceRequest ? (
          smartPlaceCountries.length === 0 && !isLoading ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              {smartPlaceRequest.source === "gps"
                ? "No GPS countries found yet. Run metadata scan with GPS location detection to generate country smart albums."
                : "No non-GPS country-like locations found yet."}
            </div>
          ) : (
            <SmartPlaceTree
              smartPlaceRequest={smartPlaceRequest}
              smartPlaceCountries={smartPlaceCountries}
              expandedSmartCountries={expandedSmartCountries}
              expandedSmartGroups={expandedSmartGroups}
              smartPlaceGroupLabel={smartPlaceGroupLabel}
              smartPlaceEntryLabel={smartPlaceEntryLabel}
              onToggleCountry={onToggleCountry}
              onToggleGroup={onToggleGroup}
              onActiveSmartAlbumChange={onActiveSmartAlbumChange}
            />
          )
        ) : smartYears.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            No dated media found yet. Run metadata scan to generate Best of Year smart albums.
          </div>
        ) : (
          <BestOfYearCards years={smartYears} onActiveSmartAlbumChange={onActiveSmartAlbumChange} />
        )
      ) : (
        <DesktopAlbumContentGrid
          store={store}
          albumItems={smartItems}
          albumItemsPage={smartItemsPage}
          albumItemsTotal={smartItemsTotal}
          quickFilters={quickFilters}
          viewMode={viewMode}
          onAlbumItemsPageChange={onSmartItemsPageChange}
        />
      )}
    </div>
  );
}

function SmartPlaceTree({
  smartPlaceRequest,
  smartPlaceCountries,
  expandedSmartCountries,
  expandedSmartGroups,
  smartPlaceGroupLabel,
  smartPlaceEntryLabel,
  onToggleCountry,
  onToggleGroup,
  onActiveSmartAlbumChange,
}: {
  smartPlaceRequest: SmartAlbumPlacesRequest;
  smartPlaceCountries: SmartAlbumPlaceCountry[];
  expandedSmartCountries: string[];
  expandedSmartGroups: string[];
  smartPlaceGroupLabel: string;
  smartPlaceEntryLabel: string;
  onToggleCountry: (country: string) => void;
  onToggleGroup: (country: string, group: string) => void;
  onActiveSmartAlbumChange: (album: ActiveSmartAlbum) => void;
}): ReactElement {
  return (
    <div className="space-y-2">
      {smartPlaceCountries.map((country) => {
        const isCountryExpanded = expandedSmartCountries.includes(country.country);
        return (
          <div key={country.country} className="rounded-lg border border-border bg-card/60">
            <button
              type="button"
              onClick={() => onToggleCountry(country.country)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted"
            >
              {isCountryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <div className="font-semibold text-foreground">{country.country}</div>
              <div className="ml-auto text-sm text-muted-foreground">
                {country.groups.length} {smartPlaceGroupLabel} · {country.mediaCount} items
              </div>
            </button>
            {isCountryExpanded ? (
              <div className="space-y-2 border-t border-border px-3 py-2">
                {smartPlaceRequest.grouping === "month-area" ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {country.groups.flatMap((group) =>
                      group.entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onActiveSmartAlbumChange({ kind: "place", entry })}
                          className="rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted"
                        >
                          <div className="font-semibold text-foreground">
                            {group.group} {entry.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{entry.mediaCount} items</div>
                        </button>
                      )),
                    )}
                  </div>
                ) : (
                  country.groups.map((group) => {
                    const groupKey = `${country.country}::${group.group}`;
                    const isGroupExpanded = expandedSmartGroups.includes(groupKey);
                    return (
                      <div key={groupKey} className="rounded-md border border-border/70 bg-background/70">
                        <button
                          type="button"
                          onClick={() => onToggleGroup(country.country, group.group)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
                        >
                          {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <div className="font-medium text-foreground">{group.group}</div>
                          <div className="ml-auto text-xs text-muted-foreground">
                            {group.entries.length} {smartPlaceEntryLabel} · {group.mediaCount} items
                          </div>
                        </button>
                        {isGroupExpanded ? (
                          <div className="grid grid-cols-1 gap-2 border-t border-border/70 p-2 md:grid-cols-2 xl:grid-cols-3">
                            {group.entries.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => onActiveSmartAlbumChange({ kind: "place", entry })}
                                className="rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted"
                              >
                                <div className="font-semibold text-foreground">{entry.label}</div>
                                <div className="text-xs text-muted-foreground">{entry.mediaCount} items</div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BestOfYearCards({
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
