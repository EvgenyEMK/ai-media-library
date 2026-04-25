// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_THUMBNAIL_QUICK_FILTERS } from "@emk/media-metadata-core";
import type { AlbumMediaItem } from "@emk/shared-contracts";
import { createDesktopStore, DesktopStoreProvider } from "../stores/desktop-store";
import { DesktopAlbumContentGrid } from "./DesktopAlbumContentGrid";

const item: AlbumMediaItem = {
  id: "item-1",
  sourcePath: "C:/photos/item.jpg",
  title: "Lake photo",
  imageUrl: "C:/photos/item.jpg",
  mediaKind: "image",
  starRating: 4,
  width: 100,
  height: 100,
};

function renderGrid({
  albumItems = [item],
  quickFilters = DEFAULT_THUMBNAIL_QUICK_FILTERS,
  viewMode = "grid" as "grid" | "list",
} = {}) {
  const store = createDesktopStore();
  const openViewerSpy = vi.spyOn(store.getState(), "openViewer");
  render(
    <DesktopStoreProvider
      initialState={{
        mediaMetadataByItemId: {
          [item.sourcePath]: {
            aiMetadata: null,
            faceConfidences: [],
            starRating: item.starRating,
            photoTakenAt: "2024-06-15",
            fileCreatedAt: null,
            photoTakenPrecision: "day",
            eventDateStart: null,
            eventDateEnd: null,
            country: "Croatia",
            city: "Split",
            locationArea: null,
            locationPlace: null,
            locationName: null,
            mediaKind: "image",
          },
        },
      }}
    >
      <DesktopAlbumContentGrid
        store={store}
        albumItems={albumItems}
        albumItemsPage={0}
        albumItemsTotal={albumItems.length}
        quickFilters={quickFilters}
        viewMode={viewMode}
        onAlbumItemsPageChange={vi.fn()}
      />
    </DesktopStoreProvider>,
  );
  return { openViewerSpy };
}

describe("DesktopAlbumContentGrid", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders an empty album state", () => {
    renderGrid({ albumItems: [] });

    expect(screen.getByText("This album is empty.")).toBeVisible();
  });

  it("renders a no-match state when quick filters exclude all loaded items", () => {
    renderGrid({
      quickFilters: {
        ...DEFAULT_THUMBNAIL_QUICK_FILTERS,
        locationEnabled: true,
        locationQuery: "Paris",
      },
    });

    expect(screen.getByText("No album items match the current filters.")).toBeVisible();
  });

  it("shows date metadata in list view and opens the album viewer", () => {
    const { openViewerSpy } = renderGrid({ viewMode: "list" });

    expect(screen.getByText("Lake photo")).toBeVisible();
    expect(screen.getByText(new Date("2024-06-15T12:00:00Z").toLocaleDateString())).toBeVisible();

    fireEvent.click(screen.getByText("Lake photo"));

    expect(openViewerSpy).toHaveBeenCalledWith(
      0,
      "album",
      expect.objectContaining({
        autoPlayInitialVideo: false,
        itemListOverride: expect.arrayContaining([
          expect.objectContaining({ sourcePath: item.sourcePath }),
        ]),
      }),
    );
  });
});
