export interface SmartPlaceHierarchyLevels {
  area1: boolean;
  area2: boolean;
  city: boolean;
}

export const DEFAULT_SMART_PLACE_HIERARCHY_LEVELS: SmartPlaceHierarchyLevels = {
  area1: true,
  area2: true,
  city: true,
};

export type SmartPlaceHierarchySegmentKey = "country" | "area1" | "area2" | "city";

export function formatHierarchySegmentLabel(key: SmartPlaceHierarchySegmentKey): string {
  if (key === "country") return "Country";
  if (key === "area1") return "Area 1";
  if (key === "area2") return "Area 2";
  return "City";
}

/**
 * Toggles one place hierarchy level. Returns `null` if the toggle would leave
 * all of Area 1, Area 2, and City deselected (invalid state).
 */
export function toggleSmartPlaceHierarchyLevel(
  current: SmartPlaceHierarchyLevels,
  key: "area1" | "area2" | "city",
): SmartPlaceHierarchyLevels | null {
  const next: SmartPlaceHierarchyLevels = { ...current, [key]: !current[key] };
  if (!next.area1 && !next.area2 && !next.city) {
    return null;
  }
  return next;
}
