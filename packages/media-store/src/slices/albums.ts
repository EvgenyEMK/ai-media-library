import type { StateCreator } from "zustand";
import type { MediaStoreAlbum } from "../types";

export interface AlbumsSlice {
  albums: MediaStoreAlbum[];
  selectedAlbumId: string | null;
  recentAlbumIds: string[];

  setAlbums: (albums: MediaStoreAlbum[]) => void;
  selectAlbum: (id: string | null) => void;
  setRecentAlbumIds: (ids: string[]) => void;
  markAlbumUsed: (id: string) => void;
  upsertAlbum: (album: MediaStoreAlbum) => void;
  updateAlbum: (id: string, updates: Partial<MediaStoreAlbum>) => void;
  removeAlbum: (id: string) => void;
}

export const createAlbumsSlice: StateCreator<AlbumsSlice, [["zustand/immer", never]]> = (set) => ({
  albums: [],
  selectedAlbumId: null,
  recentAlbumIds: [],

  setAlbums: (albums) =>
    set((state) => {
      state.albums = albums;
    }),

  selectAlbum: (id) =>
    set((state) => {
      state.selectedAlbumId = id;
      if (id) {
        state.recentAlbumIds = [id, ...state.recentAlbumIds.filter((existing: string) => existing !== id)].slice(
          0,
          10,
        );
      }
    }),

  setRecentAlbumIds: (ids) =>
    set((state) => {
      state.recentAlbumIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 10);
    }),

  markAlbumUsed: (id) =>
    set((state) => {
      state.recentAlbumIds = [id, ...state.recentAlbumIds.filter((existing: string) => existing !== id)].slice(
        0,
        10,
      );
    }),

  upsertAlbum: (album) =>
    set((state) => {
      const index = state.albums.findIndex((a: MediaStoreAlbum) => a.id === album.id);
      if (index === -1) {
        state.albums.unshift(album);
      } else {
        state.albums[index] = album;
      }
    }),

  updateAlbum: (id, updates) =>
    set((state) => {
      const index = state.albums.findIndex((a: MediaStoreAlbum) => a.id === id);
      if (index !== -1) {
        Object.assign(state.albums[index]!, updates);
      }
    }),

  removeAlbum: (id) =>
    set((state) => {
      state.albums = state.albums.filter((a: MediaStoreAlbum) => a.id !== id);
      state.recentAlbumIds = state.recentAlbumIds.filter((albumId: string) => albumId !== id);
      if (state.selectedAlbumId === id) {
        state.selectedAlbumId = null;
      }
    }),
});
