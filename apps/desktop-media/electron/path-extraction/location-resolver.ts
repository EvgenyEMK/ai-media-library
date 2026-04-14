import type { SourcedLocation, LocationSource } from "./types";

export interface ResolvedLocation {
  country: string | null;
  city: string | null;
  area: string | null;
  place: string | null;
  source: LocationSource;
}

/**
 * Priority order for location sources (highest first).
 * GPS reverse-geocode is future but reserved as highest.
 */
const SOURCE_PRIORITY: LocationSource[] = [
  "gps",
  "embedded_xmp",
  "path_llm",
  "path_script",
  "ai_vision",
];

/**
 * Pick the best available location from multiple sources.
 * Returns the highest-priority source that has at least one non-empty field.
 */
export function resolveLocation(
  sources: SourcedLocation[],
): ResolvedLocation | null {
  for (const src of SOURCE_PRIORITY) {
    const match = sources.find((s) => s.source === src);
    if (match && hasAnyLocationField(match)) {
      return {
        country: match.country ?? null,
        city: match.city ?? null,
        area: match.area ?? null,
        place: match.place_name ?? null,
        source: match.source,
      };
    }
  }
  return null;
}

function hasAnyLocationField(loc: SourcedLocation): boolean {
  return !!(loc.country || loc.city || loc.area || loc.place_name);
}
