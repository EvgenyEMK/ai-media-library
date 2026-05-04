import type { SmartAlbumPlaceCountry, SmartAlbumPlaceEntry } from "@emk/shared-contracts";
import type { SmartPlaceHierarchyLevels } from "./smart-place-hierarchy";

interface AreaCityLeaf {
  key: string;
  country: string;
  area1: string;
  area2: string;
  city: string;
  label: string;
  mediaCount: number;
}

export interface AreaCityNode {
  key: string;
  label: string;
  mediaCount: number;
  children: AreaCityNode[] | null;
  leafEntry: SmartAlbumPlaceEntry | null;
}

export function isAreaCityNodeExpandable(node: { children?: AreaCityNode[] | null }): boolean {
  return Array.isArray(node.children) && node.children.length > 0;
}

export function buildAreaCityTreeForCountry(
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
