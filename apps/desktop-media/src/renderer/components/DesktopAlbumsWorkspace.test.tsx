// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { AlbumMediaItem, MediaAlbumSummary } from "@emk/shared-contracts";
import { DesktopStoreProvider } from "../stores/desktop-store";
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
    const [mode, setMode] = useState<"list" | "detail" | "create">("detail");
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
          searchControlsOpen={searchControlsOpen}
          onSearchControlsOpenChange={setSearchControlsOpen}
        />
      </DesktopStoreProvider>
    );
  }

  render(<WorkspaceHarness />);
}

describe("DesktopAlbumsWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
