import { type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  AlbumMediaItem,
  SmartAlbumPlaceCountry,
  SmartAlbumPlaceEntry,
  SmartAlbumPlacesRequest,
  SmartAlbumYearSummary,
} from "@emk/shared-contracts";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import { DesktopAlbumContentGrid } from "./DesktopAlbumContentGrid";
import { toFileUrl } from "./face-cluster-utils";
import type { ActiveSmartAlbum, SmartPlaceHierarchyLevels } from "./useSmartAlbums";

interface AreaCityLeaf {
  key: string;
  country: string;
  area1: string;
  area2: string;
  city: string;
  label: string;
  mediaCount: number;
}

function isExpandable(node: { children?: AreaCityNode[] | null }): boolean {
  return Array.isArray(node.children) && node.children.length > 0;
}

interface AreaCityNode {
  key: string;
  label: string;
  mediaCount: number;
  children: AreaCityNode[] | null;
  leafEntry: SmartAlbumPlaceEntry | null;
}

function formatHierarchySegmentLabel(key: "country" | "area1" | "area2" | "city"): string {
  if (key === "country") return "Country";
  if (key === "area1") return "Area 1";
  if (key === "area2") return "Area 2";
  return "City";
}

function buildAreaCityTreeForCountry(
  country: SmartAlbumPlaceCountry,
  levels: SmartPlaceHierarchyLevels,
): AreaCityNode[] {
  const areaLevels: Array<"area1" | "area2" | "city"> = [];
  if (levels.area1) areaLevels.push("area1");
  if (levels.area2) areaLevels.push("area2");
  if (levels.city) areaLevels.push("city");

  const leaves: AreaCityLeaf[] = [];
  for (const group of country.groups) {
    const area1 = (group.groupParent ?? group.group).trim();
    const area2 = group.group.trim();
    for (const entry of group.entries) {
      const city = entry.label.trim();
      leaves.push({
        key: `${country.country}::${area1}::${area2}::${city}`,
        country: country.country,
        area1,
        area2,
        city,
        label: city,
        mediaCount: entry.mediaCount,
      });
    }
  }

  function leafEntryFromBucket(
    bucket: AreaCityLeaf[],
    leafLevel: "area1" | "area2" | "city",
    label: string,
  ): SmartAlbumPlaceEntry {
    const sample = bucket[0];
    return {
      id: `dynamic:${sample.country}:${leafLevel}:${label}`,
      country: sample.country,
      city: leafLevel === "city" ? label : sample.city,
      group: leafLevel === "area1" ? sample.area1 : sample.area2,
      groupParent: levels.area1 ? sample.area1 : null,
      area1: levels.area1 ? sample.area1 : null,
      area2: sample.area2,
      leafLevel,
      label,
      mediaCount: bucket.reduce((sum, item) => sum + item.mediaCount, 0),
    };
  }

  function build(nodes: AreaCityLeaf[], depth: number, pathKey: string): AreaCityNode[] {
    const level = areaLevels[depth];
    if (!level) return [];

    const grouped = new Map<string, AreaCityLeaf[]>();
    for (const leaf of nodes) {
      const area1 = leaf.area1;
      const area2 = leaf.area2;
      const city = leaf.city;
      const label = level === "area1" ? area1 : level === "area2" ? area2 : city;
      const key = label.length > 0 ? label : "Unknown";
      const bucket = grouped.get(key) ?? [];
      bucket.push(leaf);
      grouped.set(key, bucket);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, bucket]) => {
        const nodeKey = `${pathKey}::${level}:${label}`;
        const hasNextLevel = depth < areaLevels.length - 1;
        const children = hasNextLevel ? build(bucket, depth + 1, nodeKey) : null;
        const mediaCount = bucket.reduce((sum, item) => sum + item.mediaCount, 0);
        const leafEntry = hasNextLevel ? null : leafEntryFromBucket(bucket, level, label);
        return {
          key: nodeKey,
          label,
          mediaCount,
          children,
          leafEntry,
        };
      });
  }

  return build(leaves, 0, country.country);
}

function renderAreaCityNodes(params: {
  nodes: AreaCityNode[];
  country: string;
  expandedSmartGroups: string[];
  onToggleGroup: (country: string, group: string) => void;
  onActiveSmartAlbumChange: (album: ActiveSmartAlbum) => void;
  depth?: number;
}): ReactElement {
  const {
    nodes,
    country,
    expandedSmartGroups,
    onToggleGroup,
    onActiveSmartAlbumChange,
    depth = 0,
  } = params;
  const allNodesAreLeaves = nodes.every((node) => !isExpandable(node));
  const containerClassName =
    allNodesAreLeaves
      ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
      : depth === 0
      ? "space-y-2"
      : depth >= 2
        ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
        : "grid grid-cols-1 gap-2";

  return (
    <div className={containerClassName}>
      {nodes.map((node) => {
        const expandable = isExpandable(node);
        const expandedKey = `${country}::${node.key}`;
        if (!expandable && node.leafEntry) {
          return (
            <button
              key={node.key}
              type="button"
              onClick={() => onActiveSmartAlbumChange({ kind: "place", entry: node.leafEntry as SmartAlbumPlaceEntry })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted sm:w-auto"
            >
              <div className="font-semibold text-foreground">{node.label}</div>
              <div className="text-xs text-muted-foreground">{node.mediaCount} items</div>
            </button>
          );
        }

        const expanded = expandedSmartGroups.includes(expandedKey);
        return (
          <div key={node.key} className="rounded-md border border-border/70 bg-background/70">
            <button
              type="button"
              onClick={() => onToggleGroup(country, node.key)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <div className="font-medium text-foreground">{node.label}</div>
              <div className="ml-auto text-xs text-muted-foreground">{node.mediaCount} items</div>
            </button>
            {expanded && node.children ? (
              <div className="border-t border-border/70 p-2">
                {renderAreaCityNodes({
                  nodes: node.children,
                  country,
                  expandedSmartGroups,
                  onToggleGroup,
                  onActiveSmartAlbumChange,
                  depth: depth + 1,
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

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
  smartPlaceHierarchyLevels,
  onToggleCountry,
  onToggleGroup,
  onSmartPlaceHierarchyLevelsChange,
  onActiveSmartAlbumChange,
}: {
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
  const toggleHierarchy = (key: "area1" | "area2" | "city"): void => {
    if (!areaCityMode) {
      return;
    }
    const current = smartPlaceHierarchyLevels;
    if (key === "city") {
      onSmartPlaceHierarchyLevelsChange({ ...current, city: !current.city });
      return;
    }
    if (key === "area1") {
      if (current.area1 && !current.area2) {
        onSmartPlaceHierarchyLevelsChange({ ...current, area1: false, area2: true });
      } else {
        onSmartPlaceHierarchyLevelsChange({ ...current, area1: !current.area1 });
      }
      return;
    }
    if (current.area2 && !current.area1) {
      onSmartPlaceHierarchyLevelsChange({ ...current, area2: false, area1: true });
    } else {
      onSmartPlaceHierarchyLevelsChange({ ...current, area2: !current.area2 });
    }
  };

  return (
    <div className="space-y-2">
      {areaCityMode ? (
        <div className="rounded-md border border-border bg-card/60 px-3 py-2 text-sm">
          <span className="font-semibold text-foreground">{formatHierarchySegmentLabel("country")}</span>
          {(["area1", "area2", "city"] as const).map((key) => (
            <span key={key}>
              {" "}
              &gt;{" "}
              <button
                type="button"
                onClick={() => toggleHierarchy(key)}
                className={`rounded px-1 py-0.5 ${
                  smartPlaceHierarchyLevels[key]
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/70 hover:bg-muted"
                }`}
                aria-pressed={smartPlaceHierarchyLevels[key]}
              >
                {formatHierarchySegmentLabel(key)}
              </button>
            </span>
          ))}
        </div>
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
                ) : areaCityMode && areaCityTree ? (
                  <div className="space-y-2">
                    {renderAreaCityNodes({
                    nodes: areaCityTree,
                    country: country.country,
                    expandedSmartGroups,
                    onToggleGroup,
                    onActiveSmartAlbumChange,
                    })}
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
