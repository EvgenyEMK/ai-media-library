import { describe, expect, it } from "vitest";
import { formatHierarchySegmentLabel, toggleSmartPlaceHierarchyLevel } from "./smart-place-hierarchy";

describe("formatHierarchySegmentLabel", () => {
  it("returns display labels for hierarchy keys", () => {
    expect(formatHierarchySegmentLabel("country")).toBe("Country");
    expect(formatHierarchySegmentLabel("area1")).toBe("Area 1");
    expect(formatHierarchySegmentLabel("area2")).toBe("Area 2");
    expect(formatHierarchySegmentLabel("city")).toBe("City");
  });
});

describe("toggleSmartPlaceHierarchyLevel", () => {
  const allOn = { area1: true, area2: true, city: true };

  it("toggles a level when at least one other stays on", () => {
    expect(toggleSmartPlaceHierarchyLevel(allOn, "area1")).toEqual({
      area1: false,
      area2: true,
      city: true,
    });
  });

  it("returns null when disabling the last selected level among area1, area2, city", () => {
    const onlyCity = { area1: false, area2: false, city: true };
    expect(toggleSmartPlaceHierarchyLevel(onlyCity, "city")).toBeNull();
    const onlyArea1 = { area1: true, area2: false, city: false };
    expect(toggleSmartPlaceHierarchyLevel(onlyArea1, "area1")).toBeNull();
  });

  it("allows enabling a level from a valid partial state", () => {
    const onlyCity = { area1: false, area2: false, city: true };
    expect(toggleSmartPlaceHierarchyLevel(onlyCity, "area1")).toEqual({
      area1: true,
      area2: false,
      city: true,
    });
  });
});
