import type {
  AlbumItemsRequest,
  AlbumItemsResult,
  AlbumListRequest,
  AlbumListResult,
  AlbumMembership,
  MediaAlbumSummary,
} from "@emk/shared-contracts";
import type { DesktopStore } from "../stores/desktop-store";

export interface DesktopAlbumActions {
  loadAlbums: (request?: AlbumListRequest) => Promise<AlbumListResult>;
  createAlbum: (title: string) => Promise<MediaAlbumSummary>;
  renameAlbum: (albumId: string, title: string) => Promise<MediaAlbumSummary>;
  deleteAlbum: (albumId: string) => Promise<void>;
  loadAlbumItems: (request: AlbumItemsRequest) => Promise<AlbumItemsResult>;
  listAlbumsForMediaItem: (mediaItemIdOrPath: string) => Promise<AlbumMembership[]>;
  addMediaItemsToAlbum: (albumId: string, mediaItemIds: string[]) => Promise<void>;
  removeMediaItemFromAlbum: (albumId: string, mediaItemId: string) => Promise<void>;
  setAlbumCover: (albumId: string, mediaItemId: string | null) => Promise<void>;
}

export function createDesktopAlbumActions(store: DesktopStore): DesktopAlbumActions {
  return {
    async loadAlbums(request) {
      const result = await window.desktopApi.listAlbums(request);
      store.getState().setAlbums(result.rows);
      return result;
    },
    async createAlbum(title) {
      const album = await window.desktopApi.createAlbum(title);
      store.getState().upsertAlbum(album);
      store.getState().selectAlbum(album.id);
      store.getState().markAlbumUsed(album.id);
      return album;
    },
    async renameAlbum(albumId, title) {
      const album = await window.desktopApi.updateAlbumTitle(albumId, title);
      store.getState().upsertAlbum(album);
      return album;
    },
    async deleteAlbum(albumId) {
      await window.desktopApi.deleteAlbum(albumId);
      store.getState().removeAlbum(albumId);
      if (store.getState().selectedAlbumId === albumId) {
        store.getState().selectAlbum(null);
      }
    },
    loadAlbumItems(request) {
      return window.desktopApi.listAlbumItems(request);
    },
    listAlbumsForMediaItem(mediaItemIdOrPath) {
      return window.desktopApi.listAlbumsForMediaItem(mediaItemIdOrPath);
    },
    async addMediaItemsToAlbum(albumId, mediaItemIds) {
      await window.desktopApi.addMediaItemsToAlbum(albumId, mediaItemIds);
      store.getState().markAlbumUsed(albumId);
    },
    removeMediaItemFromAlbum(albumId, mediaItemId) {
      return window.desktopApi.removeMediaItemFromAlbum(albumId, mediaItemId);
    },
    setAlbumCover(albumId, mediaItemId) {
      return window.desktopApi.setAlbumCover(albumId, mediaItemId);
    },
  };
}
