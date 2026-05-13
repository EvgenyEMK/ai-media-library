import { ipcMain } from "electron";
import type { GetFolderDuplicateScanResultResponse } from "../../src/shared/ipc";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import { takeFolderDuplicateScanResult } from "./folder-duplicate-scan-cache";

export function registerFolderDuplicateScanHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.getFolderDuplicateScanResult,
    (_event, jobId: unknown): GetFolderDuplicateScanResultResponse => {
      const id = typeof jobId === "string" ? jobId.trim() : "";
      if (!id) {
        return { ok: false, error: "jobId is required." };
      }
      const result = takeFolderDuplicateScanResult(id);
      if (!result) {
        return {
          ok: false,
          error: "No result for this job yet, or it was already read.",
        };
      }
      return { ok: true, result };
    },
  );
}
