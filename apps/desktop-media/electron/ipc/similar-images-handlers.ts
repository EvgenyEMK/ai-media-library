import { ipcMain } from "electron";
import { IPC_CHANNELS, type FindSimilarImagesRequest } from "../../src/shared/ipc";
import { searchSimilarImagesBySourcePath } from "../db/semantic-search";

export function registerSimilarImagesHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.findSimilarImages,
    async (_event, request: FindSimilarImagesRequest) => {
      const sourcePath = request.sourcePath?.trim();
      if (!sourcePath) {
        return { ok: false as const, error: "Source path is required." };
      }
      const minSimilarity = request.minSimilarity;
      const result = await searchSimilarImagesBySourcePath(sourcePath, minSimilarity);
      return result;
    },
  );
}
