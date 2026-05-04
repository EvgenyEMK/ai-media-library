// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import type { AlbumMediaItem, MediaAlbumSummary } from "@emk/shared-contracts";
import { DesktopStoreProvider } from "../stores/desktop-store";
import type { AlbumWorkspaceMode } from "../types/app-types";
import { DesktopAlbumsWorkspace } from "./DesktopAlbumsWorkspace";

function album(overrides: Partial<MediaAlbumSummary> = {}): MediaAlbumSummary {
  return {
    id: "member",
    title: "Member Album",
    description: null,
    coverMediaItemId: "cover-old",
    coverSourcePath: null,
    coverImageUrl: "file:///old-cover.jpg",
    coverMediaKind: "image",
    mediaCount: 2,
    locationSummary: null,
    personTags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const albumItem: AlbumMediaItem = {
  id: "cover-old",
  sourcePath: "C:/photos/item.jpg",
  title: "Lake photo",
  imageUrl: "C:/photos/item.jpg",
  mediaKind: "image",
  starRating: 4,
  width: 100,
  height: 100,
};

function installDesktopApiMock(): Record<string, ReturnType<typeof vi.fn>> {
  const firstAlbumState = album();
  const updatedAlbumState = album({
    coverMediaItemId: "cover-new",
    coverImageUrl: "file:///new-cover.jpg",
    mediaCount: 1,
  });
  const desktopApi = {
    listPersonTagsWithFaceCounts: vi.fn().mockResolvedValue([]),
    listAlbums: vi
      .fn()
      .mockResolvedValueOnce({ rows: [firstAlbumState], totalCount: 1 })
      .mockResolvedValue({ rows: [updatedAlbumState], totalCount: 1 }),
    listAlbumItems: vi.fn().mockResolvedValue({ rows: [albumItem], totalCount: 1 }),
    reorderAlbumMediaItem: vi.fn().mockResolvedValue(undefined),
    removeMediaItemFromAlbum: vi.fn().mockResolvedValue(undefined),
    setAlbumCover: vi.fn().mockResolvedValue(undefined),
    addMediaItemsToAlbum: vi.fn().mockResolvedValue(undefined),
    listAlbumsForMediaItem: vi.fn().mockResolvedValue([]),
    revealItemInFolder: vi.fn().mockResolvedValue({ success: true }),
    _logToMain: vi.fn(),
  };
  Object.defineProperty(window, "desktopApi", {
    value: desktopApi,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  return desktopApi;
}

function renderWorkspace(): void {
  function WorkspaceHarness() {
    const [mode, setMode] = useState<AlbumWorkspaceMode>("detail");
    const [searchControlsOpen, setSearchControlsOpen] = useState(false);
    return (
      <DesktopStoreProvider
        initialState={{
          albums: [album()],
          selectedAlbumId: "member",
          viewMode: "grid",
        }}
      >
        <DesktopAlbumsWorkspace
          mode={mode}
          onModeChange={setMode}
          smartAlbumRootKind="country-year-area"
          yearAreaSubView="year-city"
          onYearAreaSubViewChange={vi.fn()}
          searchControlsOpen={searchControlsOpen}
          onSearchControlsOpenChange={setSearchControlsOpen}
        />
      </DesktopStoreProvider>
    );
  }

  render(<WorkspaceHarness />);
}

function renderAlbumListWorkspace(desktopApi: ReturnType<typeof installDesktopApiMock>): void {
  function ListHarness() {
    const [mode, setMode] = useState<AlbumWorkspaceMode>("list");
    const [searchControlsOpen, setSearchControlsOpen] = useState(true);
    return (
      <DesktopStoreProvider
        initialState={{
          albums: [],
          selectedAlbumId: null,
          viewMode: "grid",
        }}
      >
        <DesktopAlbumsWorkspace
          mode={mode}
          onModeChange={setMode}
          smartAlbumRootKind="country-year-area"
          yearAreaSubView="year-city"
          onYearAreaSubViewChange={vi.fn()}
          searchControlsOpen={searchControlsOpen}
          onSearchControlsOpenChange={setSearchControlsOpen}
        />
      </DesktopStoreProvider>
    );
  }

  Object.defineProperty(window, "desktopApi", {
    value: desktopApi,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });

  render(<ListHarness />);
}

describe("DesktopAlbumsWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requests albums with personTagIds and resets offset after pagination when a person tag is toggled", async () => {
    const rowBatch = Array.from({ length: 24 }, (_, index) =>
      album({ id: `album-${index}`, title: `Album ${index}` }),
    );
    const desktopApi = {
      listPersonTagsWithFaceCounts: vi.fn().mockResolvedValue([
        { id: "tag-1", label: "River", pinned: true, taggedFaceCount: 3 },
      ]),
      listAlbums: vi
        .fn()
        .mockResolvedValue({ rows: rowBatch, totalCount: 48 }),
      listAlbumItems: vi.fn().mockResolvedValue({ rows: [], totalCount: 0 }),
      listAlbumsForMediaItem: vi.fn().mockResolvedValue([]),
      reorderAlbumMediaItem: vi.fn().mockResolvedValue(undefined),
      removeMediaItemFromAlbum: vi.fn().mockResolvedValue(undefined),
      setAlbumCover: vi.fn().mockResolvedValue(undefined),
      addMediaItemsToAlbum: vi.fn().mockResolvedValue(undefined),
      revealItemInFolder: vi.fn().mockResolvedValue({ success: true }),
      _logToMain: vi.fn(),
    };
    renderAlbumListWorkspace(desktopApi);

    await waitFor(() => expect(desktopApi.listAlbums).toHaveBeenCalled());

    const pagination = await screen.findByRole("navigation", { name: "Albums pagination" });
    fireEvent.click(within(pagination).getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      const last = desktopApi.listAlbums.mock.calls.at(-1)?.[0] as { offset?: number } | undefined;
      expect(last?.offset).toBe(24);
    });

    fireEvent.click(screen.getByRole("button", { name: "River" }));

    await waitFor(() => {
      const last = desktopApi.listAlbums.mock.calls.at(-1)?.[0] as {
        offset?: number;
        personTagIds?: string[];
        includeUnconfirmedFaces?: boolean;
      };
      expect(last?.offset).toBe(0);
      expect(last?.personTagIds).toEqual(["tag-1"]);
      expect(last?.includeUnconfirmedFaces).toBe(true);
    });
  });

  it("refreshes album list card data after removing an album item via menu", async () => {
    installDesktopApiMock();
    renderWorkspace();

    fireEvent.click(await screen.findByTitle("Open media item actions"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove from album" }));

    await waitFor(() => expect(window.desktopApi.removeMediaItemFromAlbum).toHaveBeenCalledWith("member", "C:/photos/item.jpg"));
    await waitFor(() => expect(window.desktopApi.listAlbums).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Back to albums" }));

    expect(await screen.findByText("1 item")).toBeVisible();
  });
});
