// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAlbumSummary } from "@emk/shared-contracts";
import { createDesktopAlbumActions } from "./album-actions";
import type { DesktopStore } from "../stores/desktop-store";

const album: MediaAlbumSummary = {
  id: "album-1",
  title: "Wakeboard",
  description: null,
  coverMediaItemId: null,
  coverSourcePath: null,
  coverImageUrl: null,
  coverMediaKind: "image",
  mediaCount: 0,
  locationSummary: null,
  personTags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createStoreMock(overrides: Partial<ReturnType<DesktopStore["getState"]>> = {}): DesktopStore {
  const state = {
    selectedAlbumId: null,
    setAlbums: vi.fn(),
    upsertAlbum: vi.fn(),
    selectAlbum: vi.fn(),
    markAlbumUsed: vi.fn(),
    removeAlbum: vi.fn(),
    ...overrides,
  };
  return {
    getState: vi.fn(() => state),
  } as unknown as DesktopStore;
}

function installDesktopApiMock(): Record<string, ReturnType<typeof vi.fn>> {
  const desktopApi = {
    listAlbums: vi.fn(),
    createAlbum: vi.fn(),
    updateAlbumTitle: vi.fn(),
    deleteAlbum: vi.fn(),
    listAlbumItems: vi.fn(),
    listAlbumsForMediaItem: vi.fn(),
    addMediaItemsToAlbum: vi.fn(),
    removeMediaItemFromAlbum: vi.fn(),
    reorderAlbumMediaItem: vi.fn(),
    setAlbumCover: vi.fn(),
  };
  Object.defineProperty(window, "desktopApi", {
    value: desktopApi,
    configurable: true,
  });
  return desktopApi;
}

describe("createDesktopAlbumActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads albums through IPC and stores the rows", async () => {
    const desktopApi = installDesktopApiMock();
    desktopApi.listAlbums.mockResolvedValue({ rows: [album], totalCount: 1 });
    const store = createStoreMock();

    const result = await createDesktopAlbumActions(store).loadAlbums({ limit: 10 });

    expect(desktopApi.listAlbums).toHaveBeenCalledWith({ limit: 10 });
    expect(store.getState().setAlbums).toHaveBeenCalledWith([album]);
    expect(result.totalCount).toBe(1);
  });

  it("creates albums and marks them selected and recent", async () => {
    const desktopApi = installDesktopApiMock();
    desktopApi.createAlbum.mockResolvedValue(album);
    const store = createStoreMock();

    await createDesktopAlbumActions(store).createAlbum("Wakeboard");

    expect(desktopApi.createAlbum).toHaveBeenCalledWith("Wakeboard");
    expect(store.getState().upsertAlbum).toHaveBeenCalledWith(album);
    expect(store.getState().selectAlbum).toHaveBeenCalledWith(album.id);
    expect(store.getState().markAlbumUsed).toHaveBeenCalledWith(album.id);
  });

  it("renames and upserts albums", async () => {
    const desktopApi = installDesktopApiMock();
    const renamed = { ...album, title: "Ski" };
    desktopApi.updateAlbumTitle.mockResolvedValue(renamed);
    const store = createStoreMock();

    await createDesktopAlbumActions(store).renameAlbum(album.id, "Ski");

    expect(desktopApi.updateAlbumTitle).toHaveBeenCalledWith(album.id, "Ski");
    expect(store.getState().upsertAlbum).toHaveBeenCalledWith(renamed);
  });

  it("deletes albums and removes local state", async () => {
    const desktopApi = installDesktopApiMock();
    desktopApi.deleteAlbum.mockResolvedValue(undefined);
    const store = createStoreMock({ selectedAlbumId: album.id });

    await createDesktopAlbumActions(store).deleteAlbum(album.id);

    expect(desktopApi.deleteAlbum).toHaveBeenCalledWith(album.id);
    expect(store.getState().removeAlbum).toHaveBeenCalledWith(album.id);
    expect(store.getState().selectAlbum).toHaveBeenCalledWith(null);
  });

  it("delegates item operations to IPC and updates recents when adding", async () => {
    const desktopApi = installDesktopApiMock();
    desktopApi.listAlbumItems.mockResolvedValue({ rows: [], totalCount: 0 });
    desktopApi.listAlbumsForMediaItem.mockResolvedValue([{ albumId: album.id, title: album.title }]);
    desktopApi.addMediaItemsToAlbum.mockResolvedValue(undefined);
    desktopApi.removeMediaItemFromAlbum.mockResolvedValue(undefined);
    desktopApi.setAlbumCover.mockResolvedValue(undefined);
    const store = createStoreMock();
    const actions = createDesktopAlbumActions(store);

    await expect(actions.loadAlbumItems({ albumId: album.id })).resolves.toEqual({ rows: [], totalCount: 0 });
    await expect(actions.listAlbumsForMediaItem("C:/photo.jpg")).resolves.toEqual([
      { albumId: album.id, title: album.title },
    ]);
    await actions.addMediaItemsToAlbum(album.id, ["item-1"]);
    await actions.removeMediaItemFromAlbum(album.id, "item-1");
    await actions.setAlbumCover(album.id, "item-1");

    expect(desktopApi.addMediaItemsToAlbum).toHaveBeenCalledWith(album.id, ["item-1"]);
    expect(store.getState().markAlbumUsed).toHaveBeenCalledWith(album.id);
    expect(desktopApi.removeMediaItemFromAlbum).toHaveBeenCalledWith(album.id, "item-1");
    expect(desktopApi.setAlbumCover).toHaveBeenCalledWith(album.id, "item-1");
  });

  it("reorders album items through IPC and marks album used", async () => {
    const desktopApi = installDesktopApiMock();
    desktopApi.reorderAlbumMediaItem.mockResolvedValue(undefined);
    const store = createStoreMock();
    const actions = createDesktopAlbumActions(store);

    await actions.reorderAlbumMediaItem({
      albumId: album.id,
      mediaItemId: "item-2",
      insertBeforeIndex: 0,
    });

    expect(desktopApi.reorderAlbumMediaItem).toHaveBeenCalledWith({
      albumId: album.id,
      mediaItemId: "item-2",
      insertBeforeIndex: 0,
    });
    expect(store.getState().markAlbumUsed).toHaveBeenCalledWith(album.id);
  });
});
