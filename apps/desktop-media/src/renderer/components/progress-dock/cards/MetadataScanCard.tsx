import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { MetadataProgressState } from "../../../hooks/use-eta-tracking";
import { UI_TEXT } from "../../../lib/ui-text";
import { formatCount, formatCountRatio } from "../../../lib/progress-stats-format";
import type { DesktopStore } from "../../../stores/desktop-store";
import type { MetadataScanPhase } from "../../../../shared/ipc";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { useProgressEta } from "./use-progress-eta";
import { ProgressCardBody } from "./ProgressCardBody";

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
  const metadataSteps = metadataProgress.metadataGpsGeocodingEnabled ? 4 : 3;
  const metadataStepIndex =
    metadataPhase === "preparing"
      ? 1
      : metadataPhase === "scanning"
        ? 2
        : metadataPhase === "geocoding"
          ? 3
          : metadataPhase === "finalizing"
            ? metadataSteps
            : null;
  const metadataStepPrefix =
    isMetadataScanning && metadataStepIndex !== null ? `${metadataStepIndex}/${metadataSteps}: ` : "";
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
      metadataPhase === "preparing" ||
        metadataPhase === "scanning" ||
        metadataPhase === "geocoding" ||
        metadataPhase === "finalizing"
        ? metadataPhaseProcessed
        : metadataProgress.metadataProcessed,
    total:
      metadataPhase === "preparing" ||
        metadataPhase === "scanning" ||
        metadataPhase === "geocoding" ||
        metadataPhase === "finalizing"
        ? metadataPhaseTotal
        : metadataProgress.metadataTotal,
  });
  const primaryProgressPercent = metadataBarPercent;
  const statsText =
    isMetadataScanning && metadataPhase === "preparing"
      ? `${metadataProgress.metadataProgressLabel} ${formatCountRatio(metadataPhaseProcessed, metadataPhaseTotal)}`
      : isMetadataScanning && metadataPhase === "geocoding"
        ? `${metadataProgress.metadataProgressLabel} ${formatCountRatio(metadataPhaseProcessed, metadataPhaseTotal)} | With GPS: ${formatCount(metadataProgress.metadataGeoDataUpdated)}`
        : isMetadataScanning && metadataPhase === "finalizing"
          ? `${metadataProgress.metadataProgressLabel} ${formatCountRatio(metadataPhaseProcessed, metadataPhaseTotal)}`
          : `${metadataProgress.metadataProgressLabel ? `${metadataProgress.metadataProgressLabel} ` : ""}Processed: ${formatCountRatio(metadataProgress.metadataProcessed, metadataProgress.metadataTotal)} | New: ${formatCount(metadataProgress.metadataCounts.created)} | Updated: ${formatCount(metadataProgress.metadataCounts.updated)}${metadataProgress.metadataCounts.failed > 0 ? ` | Failed: ${formatCount(metadataProgress.metadataCounts.failed)}` : ""}${metadataProgress.metadataGpsGeocodingEnabled && metadataPhase !== "geocoding" ? ` | With GPS: ${formatCount(metadataProgress.metadataGeoDataUpdated)}` : ""}`;
  const rightText = metadataTimeLeftText
    ? `${UI_TEXT.analysisTimeLeftLabel}: ${metadataTimeLeftText}`
    : null;

  return (
    <ProgressCardBody
      title={
        <>
          {metadataProgress.metadataScanFinalizing ? (
            <Loader2
              size={14}
              className="shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
          <span className="min-w-0">
            {metadataStepPrefix}
            {metadataProgress.metadataCardTitle}
            {metadataProgress.metadataFolderName ? ` - ${metadataProgress.metadataFolderName}` : ""}
          </span>
        </>
      }
      action={
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
      }
      progressPercent={primaryProgressPercent}
      ariaLabel={
        metadataPhase === "preparing"
          ? UI_TEXT.metadataScanPreparing
          : metadataPhase === "scanning"
            ? UI_TEXT.metadataScanScanning
            : metadataPhase === "finalizing"
              ? UI_TEXT.metadataScanFinalizing
            : "Metadata scan progress"
      }
      statsText={statsText}
      rightText={rightText}
      showProgress={isMetadataScanning || metadataProgress.metadataTotal > 0}
      secondaryBarPercent={metadataPhase === "geocoding" ? geocodingProgressPercent : null}
      secondaryBarAriaLabel={UI_TEXT.metadataScanGeocoding}
    />
  );
}
