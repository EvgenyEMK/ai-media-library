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
  it("replaces albums with setAlbums", () => {
    const store = createTestStore();
    const skiAlbum = { ...album, id: "album-2", title: "Ski" };

    store.getState().upsertAlbum(album);
    store.getState().setAlbums([skiAlbum]);

    expect(store.getState().albums).toEqual([skiAlbum]);
  });

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

  it("updates an existing album by id", () => {
    const store = createTestStore();
    store.getState().upsertAlbum(album);

    store.getState().updateAlbum(album.id, { title: "Renamed", mediaCount: 3 });

    expect(store.getState().albums[0]).toMatchObject({
      id: album.id,
      title: "Renamed",
      mediaCount: 3,
    });
  });

  it("selects albums and moves them to the top of recents", () => {
    const store = createTestStore();
    store.getState().setRecentAlbumIds(["album-2", album.id]);

    store.getState().selectAlbum(album.id);

    expect(store.getState().selectedAlbumId).toBe(album.id);
    expect(store.getState().recentAlbumIds).toEqual([album.id, "album-2"]);
  });

  it("deduplicates and caps setRecentAlbumIds", () => {
    const store = createTestStore();

    store.getState().setRecentAlbumIds([
      "album-1",
      "album-2",
      "album-1",
      "album-3",
      "album-4",
      "album-5",
      "album-6",
      "album-7",
      "album-8",
      "album-9",
      "album-10",
      "album-11",
    ]);

    expect(store.getState().recentAlbumIds).toEqual([
      "album-1",
      "album-2",
      "album-3",
      "album-4",
      "album-5",
      "album-6",
      "album-7",
      "album-8",
      "album-9",
      "album-10",
    ]);
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

  it("removes albums from list, recent ids, and selection", () => {
    const store = createTestStore();
    const skiAlbum = { ...album, id: "album-2", title: "Ski" };
    store.getState().setAlbums([album, skiAlbum]);
    store.getState().setRecentAlbumIds([skiAlbum.id, album.id]);
    store.getState().selectAlbum(album.id);

    store.getState().removeAlbum(album.id);

    expect(store.getState().albums).toEqual([skiAlbum]);
    expect(store.getState().recentAlbumIds).toEqual([skiAlbum.id]);
    expect(store.getState().selectedAlbumId).toBeNull();
  });
});
