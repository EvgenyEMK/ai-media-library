import { app, BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS, type SetMediaItemStarRatingRequest } from "../../src/shared/ipc";
import { updateMediaItemStarRatingInDb } from "../db/media-item-star-rating-update";
import {
  getMediaItemMetadataByPaths,
  upsertMediaItemFromFilePath,
} from "../db/media-item-metadata";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { refreshObservedStateForPaths } from "../db/file-identity";
import { writeStarRatingToMediaFile } from "../lib/write-star-rating-exiftool";
import { readSettings } from "../storage";

/**
 * After a background file-metadata write completes, push the refreshed catalog
 * row to the renderer so the grid reflects the new mtime / hash without the
 * user having to re-select the folder.
 */
function notifyRendererMetadataRefresh(sourcePath: string, libraryId: string): void {
  const byPath = getMediaItemMetadataByPaths([sourcePath], libraryId);
  const meta = byPath[sourcePath];
  if (!meta) return;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(IPC_CHANNELS.mediaItemMetadataRefreshed, { [sourcePath]: meta });
      } catch {
        // Window may be disposed; safe to ignore.
      }
    }
  }
}

export function registerMediaItemMutationHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.setMediaItemStarRating,
    async (_event, request: SetMediaItemStarRatingRequest) => {
      const sourcePath = typeof request?.sourcePath === "string" ? request.sourcePath.trim() : "";
      const starRating =
        typeof request?.starRating === "number" && Number.isFinite(request.starRating)
          ? Math.round(request.starRating)
          : Number.NaN;

      if (!sourcePath) {
        return { success: false, error: "sourcePath is required." };
      }
      if (!Number.isInteger(starRating) || starRating < 0 || starRating > 5) {
        return { success: false, error: "starRating must be an integer from 0 to 5." };
      }

      const libraryId = DEFAULT_LIBRARY_ID;
      const updated = updateMediaItemStarRatingInDb({
        sourcePath,
        starRating,
        libraryId,
      });

      if (!updated.ok) {
        return { success: false, error: updated.error };
      }

      const metadata = updated.metadata;

      const settings = await readSettings(app.getPath("userData"));
      if (settings.folderScanning.writeEmbeddedMetadataOnUserEdit) {
        // Fire-and-forget: write file metadata in background so the IPC returns
        // instantly and the renderer can update the grid immediately.
        void (async () => {
          try {
            await writeStarRatingToMediaFile(sourcePath, starRating);
            const refreshed = await refreshObservedStateForPaths([sourcePath], libraryId);
            const observedState = refreshed[sourcePath];
            await upsertMediaItemFromFilePath({
              filePath: sourcePath,
              libraryId,
              observedState,
              overrideStarRating: starRating,
              trustedEmbeddedMetadataWrite: observedState?.strongHash == null,
            });
            notifyRendererMetadataRefresh(sourcePath, libraryId);
          } catch (err) {
            console.warn(
              `[star-rating] background file write failed for ${sourcePath}:`,
              err instanceof Error ? err.message : err,
            );
          }
        })();
      }

      return { success: true, metadata };
    },
  );
}
