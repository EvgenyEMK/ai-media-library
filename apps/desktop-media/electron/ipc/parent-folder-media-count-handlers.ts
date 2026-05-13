import { ipcMain } from "electron";
import type {
  CountMediaItemsByParentFoldersRequest,
  CountMediaItemsByParentFoldersResponse,
  CountMediaItemsInFolderScopeRequest,
  CountMediaItemsInFolderScopeResponse,
} from "../../src/shared/ipc";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import { countMediaItemsInFolderScope } from "../db/folder-scope-media-count";
import { getDirectMediaItemCountsByParentFolders } from "../db/parent-folder-direct-media-counts";

function parseRequest(raw: unknown): CountMediaItemsByParentFoldersRequest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const folderPaths = (raw as { folderPaths?: unknown }).folderPaths;
  if (!Array.isArray(folderPaths) || !folderPaths.every((p) => typeof p === "string")) {
    return null;
  }
  const libraryId = (raw as { libraryId?: unknown }).libraryId;
  if (libraryId !== undefined && typeof libraryId !== "string") {
    return null;
  }
  return {
    folderPaths,
    ...(typeof libraryId === "string" && libraryId.trim().length > 0 ? { libraryId: libraryId.trim() } : {}),
  };
}

function parseFolderScopeRequest(raw: unknown): CountMediaItemsInFolderScopeRequest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const folderPath = (raw as { folderPath?: unknown }).folderPath;
  const recursive = (raw as { recursive?: unknown }).recursive;
  if (typeof folderPath !== "string" || typeof recursive !== "boolean") {
    return null;
  }
  const libraryId = (raw as { libraryId?: unknown }).libraryId;
  if (libraryId !== undefined && typeof libraryId !== "string") {
    return null;
  }
  return {
    folderPath,
    recursive,
    ...(typeof libraryId === "string" && libraryId.trim().length > 0 ? { libraryId: libraryId.trim() } : {}),
  };
}

export function registerParentFolderMediaCountHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.countMediaItemsByParentFolders,
    (_event, raw: unknown): CountMediaItemsByParentFoldersResponse => {
      const req = parseRequest(raw);
      if (!req) {
        return { ok: false, error: "Invalid request: folderPaths must be a string array." };
      }
      try {
        const counts = getDirectMediaItemCountsByParentFolders(req);
        return { ok: true, counts };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.countMediaItemsInFolderScope,
    (_event, raw: unknown): CountMediaItemsInFolderScopeResponse => {
      const req = parseFolderScopeRequest(raw);
      if (!req) {
        return {
          ok: false,
          error: "Invalid request: folderPath (string) and recursive (boolean) are required.",
        };
      }
      try {
        const count = countMediaItemsInFolderScope(req);
        return { ok: true, count };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: message };
      }
    },
  );
}
