import { type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isAreaCityNodeExpandable, type AreaCityNode } from "../../lib/build-area-city-tree";
import type { ActiveSmartAlbum } from "../useSmartAlbums";
import { SmartAlbumPlaceItemCard } from "./smart-album-place-item-card";

export function SmartAlbumAreaCityNodeList({
  nodes,
  country,
  expandedSmartGroups,
  onToggleGroup,
  onActiveSmartAlbumChange,
  depth = 0,
}: {
  nodes: AreaCityNode[];
  country: string;
  expandedSmartGroups: string[];
  onToggleGroup: (country: string, group: string) => void;
  onActiveSmartAlbumChange: (album: ActiveSmartAlbum) => void;
  depth?: number;
}): ReactElement {
  const allNodesAreLeaves = nodes.every((node) => !isAreaCityNodeExpandable(node));
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
        const expandable = isAreaCityNodeExpandable(node);
        const expandedKey = `${country}::${node.key}`;
        if (!expandable && node.leafEntry) {
          const entry = node.leafEntry;
          return (
            <SmartAlbumPlaceItemCard
              key={node.key}
              title={node.label}
              mediaCount={entry.mediaCount}
              onClick={() => onActiveSmartAlbumChange({ kind: "place", entry })}
              className="w-full sm:w-auto"
            />
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
                <SmartAlbumAreaCityNodeList
                  nodes={node.children}
                  country={country}
                  expandedSmartGroups={expandedSmartGroups}
                  onToggleGroup={onToggleGroup}
                  onActiveSmartAlbumChange={onActiveSmartAlbumChange}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
