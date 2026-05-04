import { type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  SmartAlbumPlaceCountry,
  SmartAlbumPlacesRequest,
  SmartAlbumYearAreaSubView,
} from "@emk/shared-contracts";
import { buildAreaCityTreeForCountry } from "../../lib/build-area-city-tree";
import type { SmartPlaceHierarchyLevels } from "../../lib/smart-place-hierarchy";
import type { ActiveSmartAlbum } from "../useSmartAlbums";
import { SmartAlbumAreaCityHierarchyBar } from "./smart-album-area-city-hierarchy-bar";
import { SmartAlbumAreaCityNodeList } from "./smart-album-area-city-node-list";
import { SmartAlbumPlaceItemCard } from "./smart-album-place-item-card";
import { SmartAlbumYearAreaSubviewBar } from "./smart-album-year-area-subview-bar";

export function SmartPlaceTree({
  showYearAreaSubviewBar,
  yearAreaSubView,
  onYearAreaSubViewChange,
  smartPlaceRequest,
  smartPlaceCountries,
  expandedSmartCountries,
  expandedSmartGroups,
  smartPlaceGroupLabel,
  smartPlaceEntryLabel,
  smartPlaceHierarchyLevels,
  onToggleCountry,
  onToggleGroup,
  onSmartPlaceHierarchyLevelsChange,
  onActiveSmartAlbumChange,
}: {
  showYearAreaSubviewBar: boolean;
  yearAreaSubView: SmartAlbumYearAreaSubView;
  onYearAreaSubViewChange: (next: SmartAlbumYearAreaSubView) => void;
  smartPlaceRequest: SmartAlbumPlacesRequest;
  smartPlaceCountries: SmartAlbumPlaceCountry[];
  expandedSmartCountries: string[];
  expandedSmartGroups: string[];
  smartPlaceGroupLabel: string;
  smartPlaceEntryLabel: string;
  smartPlaceHierarchyLevels: SmartPlaceHierarchyLevels;
  onToggleCountry: (country: string) => void;
  onToggleGroup: (country: string, group: string) => void;
  onSmartPlaceHierarchyLevelsChange: (next: SmartPlaceHierarchyLevels) => void;
  onActiveSmartAlbumChange: (album: ActiveSmartAlbum) => void;
}): ReactElement {
  const areaCityMode = smartPlaceRequest.grouping === "area-city";
  /** Flat time×area cards (no nested year expand). Month uses YYYY-MM; year-area uses YYYY only. */
  const flatTimeAreaGrid =
    smartPlaceRequest.grouping === "month-area" || smartPlaceRequest.grouping === "year-area";

  return (
    <div className="space-y-2">
      {showYearAreaSubviewBar ? (
        <SmartAlbumYearAreaSubviewBar subView={yearAreaSubView} onSubViewChange={onYearAreaSubViewChange} />
      ) : null}
      {areaCityMode ? (
        <SmartAlbumAreaCityHierarchyBar
          levels={smartPlaceHierarchyLevels}
          onLevelsChange={onSmartPlaceHierarchyLevelsChange}
        />
      ) : null}
      {smartPlaceCountries.map((country) => {
        const isCountryExpanded = expandedSmartCountries.includes(country.country);
        const areaCityTree = areaCityMode
          ? buildAreaCityTreeForCountry(country, smartPlaceHierarchyLevels)
          : null;
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
                {flatTimeAreaGrid ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {country.groups.flatMap((group) =>
                      group.entries.map((entry) => (
                        <SmartAlbumPlaceItemCard
                          key={entry.id}
                          title={`${group.group} ${entry.label}`}
                          mediaCount={entry.mediaCount}
                          onClick={() => onActiveSmartAlbumChange({ kind: "place", entry })}
                        />
                      )),
                    )}
                  </div>
                ) : areaCityMode && areaCityTree ? (
                  <div className="space-y-2">
                    <SmartAlbumAreaCityNodeList
                      nodes={areaCityTree}
                      country={country.country}
                      expandedSmartGroups={expandedSmartGroups}
                      onToggleGroup={onToggleGroup}
                      onActiveSmartAlbumChange={onActiveSmartAlbumChange}
                    />
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
                              <SmartAlbumPlaceItemCard
                                key={entry.id}
                                title={entry.label}
                                mediaCount={entry.mediaCount}
                                onClick={() => onActiveSmartAlbumChange({ kind: "place", entry })}
                              />
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
