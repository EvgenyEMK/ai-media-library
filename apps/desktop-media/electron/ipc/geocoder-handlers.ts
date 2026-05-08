import { app, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import {
  hasCachedGeocoderData,
  initGeocoder,
  onGeocoderStatusChange,
} from "../geocoder/reverse-geocoder";
import { resolveGeonamesPath } from "../app-paths";
import { countMediaItemsNeedingGpsGeocoding } from "../db/media-item-geocoding";
import { emitGeocoderInitProgress } from "./progress-emitters";

export function registerGeocoderHandlers(): void {
  onGeocoderStatusChange((progress) => {
    emitGeocoderInitProgress(progress);
  });

  ipcMain.handle(IPC_CHANNELS.getGeocoderCacheStatus, async () => {
    return { hasLocalCopy: hasCachedGeocoderData(resolveGeonamesPath(app)) };
  });

  ipcMain.handle(
    IPC_CHANNELS.getGpsGeocodePendingCount,
    async (_event, request: { folderPath: string; recursive?: boolean }) => {
      const folderPath = typeof request.folderPath === "string" ? request.folderPath.trim() : "";
      if (!folderPath) return 0;
      const recursive = request.recursive !== false;
      return countMediaItemsNeedingGpsGeocoding({ folderPath, recursive });
    },
  );

  ipcMain.handle(IPC_CHANNELS.initGeocoder, async (_event, options?: { forceRefresh?: boolean }) => {
    await initGeocoder(resolveGeonamesPath(app), { forceRefresh: options?.forceRefresh === true });
  });
}
