import type { StateCreator } from "zustand";
import type { MediaStoreItem } from "../types";

export interface MediaItemsSlice {
  mediaItems: MediaStoreItem[];
  mediaItemsLoading: boolean;
  mediaMetadataByItemId: Record<string, unknown>;

  setMediaItems: (items: MediaStoreItem[]) => void;
  setMediaItemsLoading: (loading: boolean) => void;
  updateMediaMetadata: (itemId: string, metadata: unknown) => void;
  setMediaMetadataMap: (map: Record<string, unknown>) => void;
  clearMediaItems: () => void;
}

export const createMediaItemsSlice: StateCreator<MediaItemsSlice, [["zustand/immer", never]]> = (set) => ({
  mediaItems: [],
  mediaItemsLoading: false,
  mediaMetadataByItemId: {},

  setMediaItems: (items) =>
    set((state) => {
      state.mediaItems = items;
    }),

  setMediaItemsLoading: (loading) =>
    set((state) => {
      state.mediaItemsLoading = loading;
    }),

  updateMediaMetadata: (itemId, metadata) =>
    set((state) => {
      state.mediaMetadataByItemId[itemId] = metadata;
    }),

  setMediaMetadataMap: (map) =>
    set((state) => {
      state.mediaMetadataByItemId = map;
    }),

  clearMediaItems: () =>
    set((state) => {
      state.mediaItems = [];
      state.mediaMetadataByItemId = {};
    }),
});
