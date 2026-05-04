import type { SmartAlbumRootKind } from "@emk/shared-contracts";

/**
 * Per smart-album-root default: open the rating/filters strip when entering this root.
 * (Merged country smart album has month, YYYY+area, and year-hierarchy sub-views.)
 */
export const SMART_ALBUM_AUTO_OPEN_FILTERS_DEFAULTS: Record<SmartAlbumRootKind, boolean> = {
  "country-year-area": false,
  "country-area-city": false,
  "ai-countries": false,
  "best-of-year": true,
};

export function smartAlbumAutoOpenFilterPanel(rootKind: SmartAlbumRootKind): boolean {
  return SMART_ALBUM_AUTO_OPEN_FILTERS_DEFAULTS[rootKind];
}
