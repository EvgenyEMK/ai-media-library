import type { StateCreator } from "zustand";
import type { MediaStoreAlbum } from "../types";

export interface AlbumsSlice {
  albums: MediaStoreAlbum[];
  selectedAlbumId: string | null;

  setAlbums: (albums: MediaStoreAlbum[]) => void;
  selectAlbum: (id: string | null) => void;
  updateAlbum: (id: string, updates: Partial<MediaStoreAlbum>) => void;
  removeAlbum: (id: string) => void;
}

export const createAlbumsSlice: StateCreator<AlbumsSlice, [["zustand/immer", never]]> = (set) => ({
  albums: [],
  selectedAlbumId: null,

  setAlbums: (albums) =>
    set((state) => {
      state.albums = albums;
    }),

  selectAlbum: (id) =>
    set((state) => {
      state.selectedAlbumId = id;
    }),

  updateAlbum: (id, updates) =>
    set((state) => {
      const index = state.albums.findIndex((a) => a.id === id);
      if (index !== -1) {
        Object.assign(state.albums[index]!, updates);
      }
    }),

  removeAlbum: (id) =>
    set((state) => {
      state.albums = state.albums.filter((a) => a.id !== id);
      if (state.selectedAlbumId === id) {
        state.selectedAlbumId = null;
      }
    }),
});
