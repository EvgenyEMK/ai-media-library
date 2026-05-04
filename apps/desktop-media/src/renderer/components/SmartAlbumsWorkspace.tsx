import { type ReactElement } from "react";
import type {
  AlbumMediaItem,
  SmartAlbumPlaceCountry,
  SmartAlbumPlacesRequest,
  SmartAlbumYearSummary,
} from "@emk/shared-contracts";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import { DesktopAlbumContentGrid } from "./DesktopAlbumContentGrid";
import type { ActiveSmartAlbum, SmartPlaceHierarchyLevels } from "./useSmartAlbums";
import { SmartAlbumBestOfYearCards } from "./smart-albums/smart-album-best-of-year-cards";
import { SmartPlaceTree } from "./smart-albums/smart-place-tree";

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
  smartPlaceHierarchyLevels,
  quickFilters,
  viewMode,
  store,
  onToggleCountry,
  onToggleGroup,
  onSmartPlaceHierarchyLevelsChange,
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
  smartPlaceHierarchyLevels: SmartPlaceHierarchyLevels;
  quickFilters: ThumbnailQuickFilterState;
  viewMode: DesktopStoreState["viewMode"];
  store: DesktopStore;
  onToggleCountry: (country: string) => void;
  onToggleGroup: (country: string, group: string) => void;
  onSmartPlaceHierarchyLevelsChange: (next: SmartPlaceHierarchyLevels) => void;
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
              smartPlaceHierarchyLevels={smartPlaceHierarchyLevels}
              onToggleCountry={onToggleCountry}
              onToggleGroup={onToggleGroup}
              onSmartPlaceHierarchyLevelsChange={onSmartPlaceHierarchyLevelsChange}
              onActiveSmartAlbumChange={onActiveSmartAlbumChange}
            />
          )
        ) : smartYears.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            No dated media found yet. Run metadata scan to generate Best of Year smart albums.
          </div>
        ) : (
          <SmartAlbumBestOfYearCards years={smartYears} onActiveSmartAlbumChange={onActiveSmartAlbumChange} />
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
