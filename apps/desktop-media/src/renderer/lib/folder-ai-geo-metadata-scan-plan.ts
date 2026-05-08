import type { FolderScanFreshness } from "../../shared/ipc";
import { formatFolderTreeScanCoveragePercentDisplay } from "./folder-ai-summary-formatters";

/** How to run metadata extraction before GPS reverse-geocoding from the Summary geo card. */
export type GeoMetadataScanPlan = "skip" | "full" | "incremental";

/**
 * Mirrors folder tree scan semantics from {@link LastDataScanCard}: skip when the tree card would be green,
 * incremental when the folder scan Play menu would appear ("only detected changes"), full otherwise.
 */
export function computeGeoMetadataScanPlan(options: {
  scanFreshness: FolderScanFreshness;
  hasSubfolders: boolean;
  loading: boolean;
  outdatedAfterDays: number;
}): GeoMetadataScanPlan {
  const { scanFreshness, hasSubfolders, loading, outdatedAfterDays } = options;
  const qs = scanFreshness.folderTreeQuickScan;

  if (loading) return "full";

  if (qs == null) return "full";

  const treeNeed = qs.treeFoldersWithDirectMediaOnDiskCount ?? 0;
  const treeCovered = qs.treeFoldersWithMetadataFolderScanCount ?? 0;
  const foldersMissingFullScan = Math.max(treeNeed - treeCovered, 0);
  const addedChanged = qs.newFileCount + qs.modifiedFileCount;

  const isRed =
    (treeNeed > 0 && foldersMissingFullScan > 0) || addedChanged > 0;

  const fullTreeCoveredByFolderScan =
    addedChanged === 0 && (treeNeed === 0 || foldersMissingFullScan === 0);

  const oldestScanMs = scanFreshness.oldestFolderScanCompletedAt
    ? new Date(scanFreshness.oldestFolderScanCompletedAt).getTime()
    : null;
  const isFullScanOutdated =
    fullTreeCoveredByFolderScan &&
    oldestScanMs != null &&
    Number.isFinite(oldestScanMs) &&
    Date.now() - oldestScanMs > outdatedAfterDays * 24 * 60 * 60 * 1000;

  const isAmber = !isRed && fullTreeCoveredByFolderScan && isFullScanOutdated;

  const isGreen = !isRed && !isAmber;

  const folderPercent = formatFolderTreeScanCoveragePercentDisplay(treeCovered, treeNeed, addedChanged);

  const folderTreePlayOpensMenu =
    hasSubfolders && folderPercent !== "100%" && folderPercent !== "0%";

  if (isGreen) return "skip";
  if (folderTreePlayOpensMenu) return "incremental";
  return "full";
}
