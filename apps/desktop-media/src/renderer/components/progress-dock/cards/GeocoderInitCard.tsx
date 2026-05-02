import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { GeocoderInitStatus } from "../../../../shared/ipc";
import { UI_TEXT } from "../../../lib/ui-text";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

interface GeocoderInitCardProps {
  store: DesktopStore;
  isGeocoderInitRunning: boolean;
  geocoderInitStatus: GeocoderInitStatus;
  geocoderInitError: string | null;
  geocoderInitProgressPercent: number | null;
  geocoderInitProgressLabel: string | null;
}

export function GeocoderInitCard({
  store,
  isGeocoderInitRunning,
  geocoderInitStatus,
  geocoderInitError,
  geocoderInitProgressPercent,
  geocoderInitProgressLabel,
}: GeocoderInitCardProps): ReactElement {
  const baseStatusText =
    geocoderInitStatus === "downloading"
      ? UI_TEXT.geocoderInitDownloading
      : geocoderInitStatus === "loading-cache"
        ? UI_TEXT.geocoderInitLoadingCache
        : geocoderInitStatus === "parsing"
          ? UI_TEXT.geocoderInitParsing
          : geocoderInitStatus === "ready"
            ? UI_TEXT.geocoderInitReady
            : "";
  const progressPercent = Math.min(
    100,
    Math.max(0, geocoderInitProgressPercent ?? (geocoderInitStatus === "ready" ? 100 : 0)),
  );
  const statsText = geocoderInitProgressLabel ? `${baseStatusText} ${geocoderInitProgressLabel}` : baseStatusText;

  return (
    <ProgressCardBody
      title={
        <>
          {isGeocoderInitRunning ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
          <span className="min-w-0">{UI_TEXT.geocoderInitPanelTitle}</span>
        </>
      }
      action={
        <ProgressDockCloseButton
          title="Close"
          ariaLabel="Close"
          onClick={() => {
            store.getState().setGeocoderInitPanelVisible(false);
          }}
        />
      }
      progressPercent={progressPercent}
      ariaLabel={UI_TEXT.geocoderInitPanelTitle}
      statsText={statsText}
      showProgress={isGeocoderInitRunning || geocoderInitStatus === "ready"}
      error={geocoderInitError ? `${UI_TEXT.geocoderInitError} ${geocoderInitError}` : null}
    />
  );
}
