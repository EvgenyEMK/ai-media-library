import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import type { GeocoderInitStatus } from "../../../../shared/ipc";
import { UI_TEXT } from "../../../lib/ui-text";
import type { DesktopStore } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";

interface GeocoderInitCardProps {
  store: DesktopStore;
  isGeocoderInitRunning: boolean;
  geocoderInitStatus: GeocoderInitStatus;
  geocoderInitError: string | null;
}

export function GeocoderInitCard({
  store,
  isGeocoderInitRunning,
  geocoderInitStatus,
  geocoderInitError,
}: GeocoderInitCardProps): ReactElement {
  return (
    <section className="m-0 rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 min-w-0 flex-1 text-sm">{UI_TEXT.geocoderInitPanelTitle}</h2>
        <div className="flex items-center gap-2">
          <ProgressDockCloseButton
            title="Close"
            ariaLabel="Close"
            onClick={() => {
              store.getState().setGeocoderInitPanelVisible(false);
            }}
          />
        </div>
      </div>
      {geocoderInitError ? (
        <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-sm text-red-200">
          {UI_TEXT.geocoderInitError} {geocoderInitError}
        </div>
      ) : null}
      {isGeocoderInitRunning ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>
            {geocoderInitStatus === "downloading"
              ? UI_TEXT.geocoderInitDownloading
              : geocoderInitStatus === "loading-cache"
                ? UI_TEXT.geocoderInitLoadingCache
                : UI_TEXT.geocoderInitParsing}
          </span>
        </div>
      ) : geocoderInitStatus === "ready" ? (
        <div className="text-xs text-muted-foreground">{UI_TEXT.geocoderInitReady}</div>
      ) : null}
    </section>
  );
}
