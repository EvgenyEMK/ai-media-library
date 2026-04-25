// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MediaAlbumSummary } from "@emk/shared-contracts";
import { DesktopStoreProvider } from "../stores/desktop-store";
import { DesktopSidebarAlbumsSection } from "./DesktopSidebarAlbumsSection";

function album(id: string, title: string): MediaAlbumSummary {
  return {
    id,
    title,
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
}

function installDesktopApiMock(albums: MediaAlbumSummary[]): void {
  Object.defineProperty(window, "desktopApi", {
    value: {
      listAlbums: vi.fn().mockResolvedValue({ rows: albums, totalCount: albums.length }),
    },
    configurable: true,
  });
}

function renderSection(options: {
  albums: MediaAlbumSummary[];
  recentAlbumIds?: string[];
  onAlbumSelected?: () => void;
  onShowAlbumList?: () => void;
}) {
  render(
    <DesktopStoreProvider
      initialState={{
        albums: options.albums,
        recentAlbumIds: options.recentAlbumIds ?? [],
      }}
    >
      <DesktopSidebarAlbumsSection
        collapsed={false}
        onAlbumSelected={options.onAlbumSelected}
        onShowAlbumList={options.onShowAlbumList}
      />
    </DesktopStoreProvider>,
  );
}

describe("DesktopSidebarAlbumsSection", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    installDesktopApiMock([album("album-a", "Alpha"), album("album-b", "Beta")]);
  });

  it("opens All albums by default when there are no recent albums", async () => {
    renderSection({ albums: [album("album-a", "Alpha"), album("album-b", "Beta")] });

    expect(await screen.findByPlaceholderText("Search albums")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
  });

  it("keeps only one subsection open and lists All albums as search results", async () => {
    renderSection({
      albums: [album("album-a", "Alpha"), album("album-b", "Beta")],
      recentAlbumIds: ["album-b"],
    });

    expect(await screen.findByRole("button", { name: "Beta" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "All albums" }));
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Search albums"), { target: { value: "alp" } });

    expect(screen.getByRole("button", { name: "Alpha" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
  });

  it("keeps visible Recent order stable after selecting an album", async () => {
    const onAlbumSelected = vi.fn();
    renderSection({
      albums: [album("album-a", "Alpha"), album("album-b", "Beta")],
      recentAlbumIds: ["album-a", "album-b"],
      onAlbumSelected,
    });
    expect(await screen.findByRole("button", { name: "Alpha" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));

    expect(onAlbumSelected).toHaveBeenCalled();
    const visibleAlbums = screen.getAllByRole("button", { name: /Alpha|Beta/ }).map((button) => button.textContent);
    expect(visibleAlbums).toEqual(["Alpha", "Beta"]);
  });

  it("notifies when All albums is opened and when an album is selected", async () => {
    const onShowAlbumList = vi.fn();
    const onAlbumSelected = vi.fn();
    renderSection({
      albums: [album("album-a", "Alpha")],
      recentAlbumIds: ["album-a"],
      onShowAlbumList,
      onAlbumSelected,
    });

    fireEvent.click(await screen.findByRole("button", { name: "All albums" }));
    await waitFor(() => expect(onShowAlbumList).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText("Search albums"), { target: { value: "alp" } });
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));

    expect(onAlbumSelected).toHaveBeenCalledTimes(1);
  });
});
