/**
 * Auto-update wiring (electron-updater + GitHub Releases).
 *
 * Publishing: configure `publish` in electron-builder.yml and attach per-OS update metadata
 * (`latest.yml` + NSIS on Windows; `latest-linux.yml` + AppImage/deb on Linux) and installers to each GitHub Release.
 * Updates apply only to packaged builds (`app.isPackaged`).
 */

import { BrowserWindow, app, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { IPC_CHANNELS, type AppUpdateUiEvent, type CheckForUpdatesResult } from "../src/shared/ipc";
import { RELEASES_LATEST_URL } from "./app-links";

let ipcRegistered = false;

function broadcastUpdateEvent(event: AppUpdateUiEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(IPC_CHANNELS.appUpdateUiEvent, event);
      } catch {
        // Window may be closing.
      }
    }
  }
}

export function registerAppUpdaterIpc(): void {
  if (ipcRegistered) {
    return;
  }
  ipcRegistered = true;

  ipcMain.handle(IPC_CHANNELS.checkForUpdates, async (): Promise<CheckForUpdatesResult> => {
    if (!app.isPackaged) {
      await shell.openExternal(RELEASES_LATEST_URL);
      return {
        ok: true,
        message: "Opened the latest releases page (updates apply to installed builds only).",
      };
    }
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.quitAndInstallUpdate, (): void => {
    if (!app.isPackaged) {
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle(IPC_CHANNELS.getAppVersion, (): string => app.getVersion());
}

export function configureAutoUpdater(): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;

  autoUpdater.on("update-available", (info) => {
    broadcastUpdateEvent({ type: "available", version: info.version });
  });

  autoUpdater.on("update-downloaded", (info) => {
    broadcastUpdateEvent({ type: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (error) => {
    broadcastUpdateEvent({
      type: "error",
      message: error.message,
    });
  });
}

/** Runs shortly after startup; notifies when an update is downloaded (electron-updater default behavior). */
export function scheduleStartupUpdateCheck(): void {
  if (!app.isPackaged) {
    return;
  }
  void autoUpdater.checkForUpdatesAndNotify();
}

/** Help menu and tray-style entry points. */
export async function triggerCheckForUpdatesFromMenu(): Promise<void> {
  if (!app.isPackaged) {
    await shell.openExternal(RELEASES_LATEST_URL);
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    broadcastUpdateEvent({ type: "error", message });
  }
}
