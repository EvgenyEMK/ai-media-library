import type { ReactElement } from "react";
import { UI_TEXT } from "../../../lib/ui-text";
import { useDesktopStoreApi } from "../../../stores/desktop-store";
import { ProgressDockCloseButton } from "../ProgressDockCloseButton";
import { ProgressCardBody } from "./ProgressCardBody";

/**
 * Shown under Pipeline queue → Completed after offline geocoder data is ready
 * (replaces the in-progress card in the legacy dock stack).
 */
export function GeocoderQueueRecentCard(): ReactElement {
  const store = useDesktopStoreApi();
  return (
    <ProgressCardBody
      title={<span className="min-w-0">{UI_TEXT.geocoderInitPanelTitle}</span>}
      action={
        <ProgressDockCloseButton
          title="Dismiss"
          ariaLabel="Dismiss geocoder completion"
          onClick={() => {
            store.getState().dismissGeocoderRecentCompletion();
          }}
        />
      }
      progressPercent={100}
      statsText={`${UI_TEXT.geocoderInitReady} — Completed`}
      showProgress
      ariaLabel={UI_TEXT.geocoderInitPanelTitle}
    />
  );
}
