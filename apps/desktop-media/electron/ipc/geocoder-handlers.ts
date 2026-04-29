import { app, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import {
  hasCachedGeocoderData,
  initGeocoder,
  onGeocoderStatusChange,
} from "../geocoder/reverse-geocoder";
import { resolveGeonamesPath } from "../app-paths";
import { emitGeocoderInitProgress } from "./progress-emitters";
import type { GeocoderStatus } from "../geocoder/geocoder-types";

export function registerGeocoderHandlers(): void {
  onGeocoderStatusChange((status: GeocoderStatus, error?: string) => {
    emitGeocoderInitProgress({ status, error });
  });

  ipcMain.handle(IPC_CHANNELS.getGeocoderCacheStatus, async () => {
    return { hasLocalCopy: hasCachedGeocoderData(resolveGeonamesPath(app)) };
  });

  ipcMain.handle(IPC_CHANNELS.initGeocoder, async (_event, options?: { forceRefresh?: boolean }) => {
    await initGeocoder(resolveGeonamesPath(app), { forceRefresh: options?.forceRefresh === true });
  });
}
