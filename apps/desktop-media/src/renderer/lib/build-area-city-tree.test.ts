import { describe, expect, it } from "vitest";
import type { SmartAlbumPlaceCountry, SmartAlbumPlaceEntry } from "@emk/shared-contracts";
import { buildAreaCityTreeForCountry, isAreaCityNodeExpandable } from "./build-area-city-tree";

function entry(partial: Partial<SmartAlbumPlaceEntry> & Pick<SmartAlbumPlaceEntry, "id" | "label" | "mediaCount">): SmartAlbumPlaceEntry {
  return {
    country: "Testland",
    city: "C1",
    group: "G2",
    ...partial,
  };
}

describe("buildAreaCityTreeForCountry", () => {
  const country: SmartAlbumPlaceCountry = {
    country: "Testland",
    mediaCount: 3,
    groups: [
      {
        group: "South",
        groupParent: "North",
        mediaCount: 3,
        entries: [
          entry({ id: "a", label: "CityA", mediaCount: 1, city: "CityA" }),
          entry({ id: "b", label: "CityB", mediaCount: 2, city: "CityB" }),
        ],
      },
    ],
  };

  it("groups by city only when only city level is enabled", () => {
    const tree = buildAreaCityTreeForCountry(country, { area1: false, area2: false, city: true });
    expect(tree.map((n) => n.label).sort()).toEqual(["CityA", "CityB"]);
    expect(tree.every((n) => n.leafEntry !== null)).toBe(true);
    expect(tree.find((n) => n.label === "CityA")?.leafEntry?.leafLevel).toBe("city");
  });

  it("builds nested nodes when area1 and city are enabled", () => {
    const tree = buildAreaCityTreeForCountry(country, { area1: true, area2: false, city: true });
    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe("North");
    expect(isAreaCityNodeExpandable(tree[0]!)).toBe(true);
    const children = tree[0]?.children ?? [];
    expect(children.map((c) => c.label).sort()).toEqual(["CityA", "CityB"]);
  });
});

describe("isAreaCityNodeExpandable", () => {
  it("returns false for leaves and true when children exist", () => {
    expect(isAreaCityNodeExpandable({ children: null })).toBe(false);
    expect(isAreaCityNodeExpandable({ children: [] })).toBe(false);
    expect(isAreaCityNodeExpandable({ children: [{ key: "k", label: "L", mediaCount: 1, children: null, leafEntry: null }] })).toBe(true);
  });
});
