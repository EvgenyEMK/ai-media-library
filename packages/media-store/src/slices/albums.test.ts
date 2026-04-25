import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { createAlbumsSlice, type AlbumsSlice } from "./albums";

function createTestStore() {
  return createStore<AlbumsSlice>()(immer(createAlbumsSlice));
}

const album = {
  id: "album-1",
  title: "Wakeboard",
  description: null,
  coverMediaItemId: null,
  coverSourcePath: null,
  coverImageUrl: null,
  coverMediaKind: "image" as const,
  mediaCount: 0,
  locationSummary: null,
  personTags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AlbumsSlice", () => {
  it("upserts new albums", () => {
    const store = createTestStore();
    store.getState().upsertAlbum(album);
    expect(store.getState().albums).toEqual([album]);
  });

  it("updates existing album by id", () => {
    const store = createTestStore();
    store.getState().upsertAlbum(album);
    store.getState().upsertAlbum({ ...album, title: "Ski" });
    expect(store.getState().albums).toHaveLength(1);
    expect(store.getState().albums[0]?.title).toBe("Ski");
  });

  it("tracks the latest 10 used albums", () => {
    const store = createTestStore();
    for (let i = 0; i < 12; i += 1) {
      store.getState().markAlbumUsed(`album-${i}`);
    }
    expect(store.getState().recentAlbumIds).toEqual([
      "album-11",
      "album-10",
      "album-9",
      "album-8",
      "album-7",
      "album-6",
      "album-5",
      "album-4",
      "album-3",
      "album-2",
    ]);
  });
});
