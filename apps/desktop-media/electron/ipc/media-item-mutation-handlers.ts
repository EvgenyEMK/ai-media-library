import { app, BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS, type SetMediaItemStarRatingRequest } from "../../src/shared/ipc";
import { updateMediaItemStarRatingInDb } from "../db/media-item-star-rating-update";
import {
  getMediaItemMetadataByPaths,
  upsertMediaItemFromFilePath,
} from "../db/media-item-metadata";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { refreshObservedStateForPaths } from "../db/file-identity";
import { canonicalPathKeyForEmbeddedWriteQueue } from "../lib/embedded-write-path-key";
import { writeStarRatingToMediaFile } from "../lib/write-star-rating-exiftool";
import { readSettings } from "../storage";

/** Serialize ExifTool writes per path so overlapping async writes cannot leave an older star rating on disk. */
const embeddedStarWriteTailByPath = new Map<string, Promise<void>>();

function enqueueEmbeddedStarWrite(sourcePath: string, starRating: number): Promise<void> {
  const key = canonicalPathKeyForEmbeddedWriteQueue(sourcePath);
  const prev = embeddedStarWriteTailByPath.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => writeStarRatingToMediaFile(sourcePath, starRating));
  embeddedStarWriteTailByPath.set(key, next);
  void next.finally(() => {
    if (embeddedStarWriteTailByPath.get(key) === next) {
      embeddedStarWriteTailByPath.delete(key);
    }
  });
  return next;
}

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
      const e2eAwait = process.env.EMK_E2E_RUN_PIPELINES_UI === "1";
      if (!settings.folderScanning.writeEmbeddedMetadataOnUserEdit) {
        let writeLog: string | undefined;
        if (e2eAwait) {
          try {
            const fs = await import("node:fs/promises");
            const p = await import("node:path");
            const logPath = p.join(app.getPath("userData"), "settings-writes.log");
            writeLog = await fs.readFile(logPath, "utf-8");
          } catch {
            writeLog = "(no log)";
          }
        }
        return {
          success: true,
          metadata,
          embeddedWrite: {
            attempted: false,
            skippedReason: "off",
            awaited: false,
            ...(writeLog ? { e2eWriteLog: writeLog } : {}),
          },
        };
      }

      const runEmbeddedWrite = async (): Promise<void> => {
        try {
          await enqueueEmbeddedStarWrite(sourcePath, starRating);
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
          if (e2eAwait) {
            throw err;
          }
        }
      };
      // In Playwright, await so rapid successive rating changes cannot race ExifTool.
      // In production, keep fire-and-forget so the grid updates immediately.
      if (e2eAwait) {
        await runEmbeddedWrite();
        return {
          success: true,
          metadata,
          embeddedWrite: { attempted: true, awaited: true },
        };
      }
      void runEmbeddedWrite();
      return {
        success: true,
        metadata,
        embeddedWrite: { attempted: true, awaited: false },
      };
    },
  );
}
