import { ipcMain } from "electron";
import type {
  AlbumItemsRequest,
  AlbumListRequest,
  SmartAlbumItemsRequest,
  SmartAlbumPlacesRequest,
} from "@emk/shared-contracts";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import {
  addMediaItemsToAlbum,
  createAlbum,
  deleteAlbum,
  listAlbumItems,
  listAlbumsForMediaItem,
  listAlbums,
  listSmartAlbumItems,
  listSmartAlbumPlaces,
  listSmartAlbumYears,
  removeMediaItemFromAlbum,
  setAlbumCover,
  updateAlbumTitle,
} from "../db/media-albums";

export function registerAlbumHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.listAlbums, async (_event, request?: AlbumListRequest) => {
    return listAlbums(request ?? {});
  });

  ipcMain.handle(IPC_CHANNELS.createAlbum, async (_event, title: string) => {
    return createAlbum(typeof title === "string" ? title : "");
  });

  ipcMain.handle(IPC_CHANNELS.updateAlbumTitle, async (_event, albumId: string, title: string) => {
    return updateAlbumTitle(
      typeof albumId === "string" ? albumId : "",
      typeof title === "string" ? title : "",
    );
  });

  ipcMain.handle(IPC_CHANNELS.deleteAlbum, async (_event, albumId: string) => {
    deleteAlbum(typeof albumId === "string" ? albumId : "");
  });

  ipcMain.handle(IPC_CHANNELS.listAlbumItems, async (_event, request: AlbumItemsRequest) => {
    return listAlbumItems(request);
  });

  ipcMain.handle(IPC_CHANNELS.listAlbumsForMediaItem, async (_event, mediaItemIdOrPath: string) => {
    return listAlbumsForMediaItem(typeof mediaItemIdOrPath === "string" ? mediaItemIdOrPath : "");
  });

  ipcMain.handle(
    IPC_CHANNELS.addMediaItemsToAlbum,
    async (_event, albumId: string, mediaItemIds: string[]) => {
      addMediaItemsToAlbum(albumId, Array.isArray(mediaItemIds) ? mediaItemIds : []);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.removeMediaItemFromAlbum,
    async (_event, albumId: string, mediaItemId: string) => {
      removeMediaItemFromAlbum(albumId, mediaItemId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.setAlbumCover,
    async (_event, albumId: string, mediaItemId: string | null) => {
      setAlbumCover(albumId, typeof mediaItemId === "string" ? mediaItemId : null);
    },
  );

  ipcMain.handle(IPC_CHANNELS.listSmartAlbumPlaces, async (_event, request: SmartAlbumPlacesRequest) => {
    return listSmartAlbumPlaces(request);
  });

  ipcMain.handle(IPC_CHANNELS.listSmartAlbumYears, async () => {
    return listSmartAlbumYears();
  });

  ipcMain.handle(IPC_CHANNELS.listSmartAlbumItems, async (_event, request: SmartAlbumItemsRequest) => {
    return listSmartAlbumItems(request);
  });
}
