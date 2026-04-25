import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { MetadataProgressState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import type { MetadataScanPhase } from "../../../../shared/ipc";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";

interface MetadataScanCardProps {
  store: DesktopStore;
  metadataProgress: MetadataProgressState;
  metadataPhase: MetadataScanPhase | null;
  metadataPhaseProcessed: number;
  metadataPhaseTotal: number;
  isMetadataScanning: boolean;
  metadataJobId: string | null;
  onCancelMetadataScan: () => void;
}

export function MetadataScanCard({
  store,
  metadataProgress,
  metadataPhase,
  metadataPhaseProcessed,
  metadataPhaseTotal,
  isMetadataScanning,
  metadataJobId,
  onCancelMetadataScan,
}: MetadataScanCardProps): ReactElement {
  const metadataBarPercent =
    metadataPhase === "geocoding" ? 100 : metadataProgress.metadataDisplayProgressPercent;
  const geocodingProgressPercent =
    metadataPhase === "geocoding" && metadataPhaseTotal > 0
      ? Math.min(100, Math.round((metadataPhaseProcessed / metadataPhaseTotal) * 100))
      : 0;
  const metadataTimeLeftText = useProgressEta({
    running: isMetadataScanning,
    jobId: metadataJobId,
    processed:
      metadataPhase === "preparing" || metadataPhase === "scanning" || metadataPhase === "geocoding"
        ? metadataPhaseProcessed
        : metadataProgress.metadataProcessed,
    total:
      metadataPhase === "preparing" || metadataPhase === "scanning" || metadataPhase === "geocoding"
        ? metadataPhaseTotal
        : metadataProgress.metadataTotal,
  });

  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          {metadataProgress.metadataScanFinalizing ? (
            <Loader2
              size={14}
              className="shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
          <span className="min-w-0">
            {metadataProgress.metadataCardTitle}
            {metadataProgress.metadataFolderName ? ` - ${metadataProgress.metadataFolderName}` : ""}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <ProgressDockCloseButton
            title={isMetadataScanning ? UI_TEXT.cancelScan : "Close metadata scan status"}
            ariaLabel={isMetadataScanning ? UI_TEXT.cancelScan : "Close metadata scan status"}
            disabled={isMetadataScanning && !metadataJobId}
            onClick={() => {
              if (isMetadataScanning) {
                onCancelMetadataScan();
              }
              store.getState().setMetadataPanelVisible(false);
            }}
          />
        </div>
      </div>
      {(isMetadataScanning || metadataProgress.metadataTotal > 0) && (
        <div className="mt-2 flex flex-col gap-2 overflow-auto">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]"
            aria-label={
              metadataPhase === "preparing"
                ? UI_TEXT.metadataScanPreparing
                : metadataPhase === "scanning"
                  ? UI_TEXT.metadataScanScanning
                  : metadataPhase === "geocoding"
                    ? "Metadata scan progress"
                    : "Metadata scan progress"
            }
          >
            <div
              className="h-full bg-[#79d7a4] transition-[width] duration-100 ease-linear"
              style={{ width: `${metadataBarPercent}%` }}
            />
          </div>
          {metadataPhase === "geocoding" ? (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]"
              aria-label={UI_TEXT.metadataScanGeocoding}
            >
              <div
                className="h-full bg-sky-400 transition-[width] duration-100 ease-linear"
                style={{ width: `${geocodingProgressPercent}%` }}
              />
            </div>
          ) : null}
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>
                {isMetadataScanning && metadataPhase === "preparing"
                  ? metadataProgress.metadataProgressLabel +
                    " " +
                    formatCountRatio(metadataPhaseProcessed, metadataPhaseTotal)
                  : isMetadataScanning && metadataPhase === "geocoding"
                    ? `${metadataProgress.metadataProgressLabel} ${formatCountRatio(metadataPhaseProcessed, metadataPhaseTotal)} | Geo data updated: ${formatCount(metadataProgress.metadataGeoDataUpdated)}`
                  : `${metadataProgress.metadataProgressLabel ? `${metadataProgress.metadataProgressLabel} ` : ""}Processed: ${formatCountRatio(metadataProgress.metadataProcessed, metadataProgress.metadataTotal)} | New: ${formatCount(metadataProgress.metadataCounts.created)} | Updated: ${formatCount(metadataProgress.metadataCounts.updated)}`}
                {metadataProgress.metadataCounts.failed > 0
                  ? ` | Failed: ${formatCount(metadataProgress.metadataCounts.failed)}`
                  : ""}
                {metadataProgress.metadataGpsGeocodingEnabled && metadataPhase !== "geocoding"
                  ? ` | Geo data updated: ${formatCount(metadataProgress.metadataGeoDataUpdated)}`
                  : ""}
              </span>
              {metadataTimeLeftText ? (
                <span className="shrink-0">
                  {UI_TEXT.analysisTimeLeftLabel}: {metadataTimeLeftText}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
