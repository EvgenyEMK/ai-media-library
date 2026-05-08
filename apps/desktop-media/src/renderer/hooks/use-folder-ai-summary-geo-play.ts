import { useCallback, useState } from "react";
import { enqueueGeoOnlyPreset } from "../lib/enqueue-geo-only-preset";
import { computeGeoMetadataScanPlan } from "../lib/folder-ai-geo-metadata-scan-plan";
import type { FolderAiSummaryOverview } from "../../shared/ipc";

export interface UseFolderAiSummaryGeoPlayParams {
  folderPath: string;
  hasSubfolders: boolean;
  dashboardOverview: FolderAiSummaryOverview | null | undefined;
  folderScanLoading: boolean;
  overviewLoading: boolean;
  folderScanOutdatedAfterDays: number;
  detectLocationFromGps: boolean;
  load: () => Promise<void>;
}

export interface UseFolderAiSummaryGeoPlayResult {
  geoPlayPending: boolean;
  runGeoLocation: () => Promise<void>;
  geoDownloadDialogOpen: boolean;
  geoDownloadBusy: boolean;
  confirmGeoDownload: () => Promise<void>;
  cancelGeoDownloadDialog: () => void;
}

export function useFolderAiSummaryGeoPlay({
  folderPath,
  hasSubfolders,
  dashboardOverview,
  folderScanLoading,
  overviewLoading,
  folderScanOutdatedAfterDays,
  detectLocationFromGps,
  load,
}: UseFolderAiSummaryGeoPlayParams): UseFolderAiSummaryGeoPlayResult {
  const [geoPlayPending, setGeoPlayPending] = useState(false);
  const [geoDownloadDialogOpen, setGeoDownloadDialogOpen] = useState(false);
  const [geoDownloadBusy, setGeoDownloadBusy] = useState(false);

  const cancelGeoDownloadDialog = useCallback((): void => {
    setGeoDownloadDialogOpen(false);
  }, []);

  const confirmGeoDownload = useCallback(async (): Promise<void> => {
    const trimmed = folderPath.trim();
    if (!trimmed) return;
    setGeoDownloadBusy(true);
    try {
      await enqueueGeoOnlyPreset(trimmed);
      setGeoDownloadDialogOpen(false);
      await load();
    } catch (err) {
      console.error("[folder-ai-summary] geo download confirmation failed:", err);
    } finally {
      setGeoDownloadBusy(false);
    }
  }, [folderPath, load]);

  const runGeoLocation = useCallback(async (): Promise<void> => {
    if (!folderPath.trim() || geoPlayPending) return;
    const overview = dashboardOverview;
    if (!overview) return;

    setGeoPlayPending(true);
    try {
      const plan = computeGeoMetadataScanPlan({
        scanFreshness: overview.scanFreshness,
        hasSubfolders,
        loading: folderScanLoading || overviewLoading,
        outdatedAfterDays: folderScanOutdatedAfterDays,
      });

      if (plan !== "skip") {
        await window.desktopApi.scanFolderMetadata({
          folderPath,
          recursive: true,
          scanScope: plan === "incremental" ? "incremental" : "full",
        });
      }

      const pendingCount = await window.desktopApi.getGpsGeocodePendingCount({
        folderPath,
        recursive: true,
      });
      if (pendingCount === 0) return;

      if (detectLocationFromGps) {
        if (plan === "skip") {
          await enqueueGeoOnlyPreset(folderPath);
        }
        return;
      }

      const cache = await window.desktopApi.getGeocoderCacheStatus();
      if (cache.hasLocalCopy) {
        await enqueueGeoOnlyPreset(folderPath);
        return;
      }

      setGeoDownloadDialogOpen(true);
    } catch (err) {
      console.error("[folder-ai-summary] geo-location flow failed:", err);
    } finally {
      setGeoPlayPending(false);
      await load();
    }
  }, [
    folderPath,
    hasSubfolders,
    dashboardOverview,
    folderScanLoading,
    overviewLoading,
    folderScanOutdatedAfterDays,
    detectLocationFromGps,
    geoPlayPending,
    load,
  ]);

  return {
    geoPlayPending,
    runGeoLocation,
    geoDownloadDialogOpen,
    geoDownloadBusy,
    confirmGeoDownload,
    cancelGeoDownloadDialog,
  };
}
