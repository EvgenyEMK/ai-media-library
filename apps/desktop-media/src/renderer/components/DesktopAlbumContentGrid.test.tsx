// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { DEFAULT_THUMBNAIL_QUICK_FILTERS } from "@emk/media-metadata-core";
import type { AlbumMediaItem } from "@emk/shared-contracts";
import { createDesktopStore, DesktopStoreProvider } from "../stores/desktop-store";
import { ALBUM_ITEMS_PAGE_SIZE } from "./DesktopAlbumDetailPanel";
import { DesktopAlbumContentGrid } from "./DesktopAlbumContentGrid";
import type { MediaThumbnailGridDragReorder } from "@emk/media-viewer";

vi.mock("@emk/media-viewer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@emk/media-viewer")>();
  return {
    ...actual,
    MediaThumbnailGrid({
      dragReorder,
      items,
    }: {
      dragReorder?: MediaThumbnailGridDragReorder;
      items: { title: string }[];
    }): ReactElement {
      return (
        <div data-testid="mock-thumbnail-grid">
          <span data-testid="mock-item-count">{items.length}</span>
          {dragReorder ? (
            <button
              type="button"
              data-testid="trigger-reorder-move"
              onClick={() => {
                dragReorder.onMove(0, 2);
              }}
            >
              simulate reorder
            </button>
          ) : null}
        </div>
      );
    },
  };
});

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
  albumId,
  albumItemsPage = 0,
  albumItemsTotal,
  reorderAlbumMediaItem,
}: {
  albumItems?: AlbumMediaItem[];
  quickFilters?: typeof DEFAULT_THUMBNAIL_QUICK_FILTERS;
  viewMode?: "grid" | "list";
  albumId?: string;
  albumItemsPage?: number;
  albumItemsTotal?: number;
  reorderAlbumMediaItem?: (params: {
    albumId: string;
    mediaItemId: string;
    insertBeforeIndex: number;
  }) => Promise<void>;
} = {}) {
  const store = createDesktopStore();
  const openViewerSpy = vi.spyOn(store.getState(), "openViewer");
  const total = albumItemsTotal ?? albumItems.length;
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
            locationArea2: null,
            locationPlace: null,
            locationName: null,
            mediaKind: "image",
          },
        },
      }}
    >
      <DesktopAlbumContentGrid
        store={store}
        albumId={albumId}
        albumItems={albumItems}
        albumItemsPage={albumItemsPage}
        albumItemsTotal={total}
        quickFilters={quickFilters}
        viewMode={viewMode}
        onAlbumItemsPageChange={vi.fn()}
        reorderAlbumMediaItem={reorderAlbumMediaItem}
      />
    </DesktopStoreProvider>,
  );
  return { openViewerSpy };
}

const itemB: AlbumMediaItem = {
  id: "item-2",
  sourcePath: "C:/photos/other.jpg",
  title: "Other",
  imageUrl: "C:/photos/other.jpg",
  mediaKind: "image",
  starRating: null,
  width: 50,
  height: 50,
};

describe("DesktopAlbumContentGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(screen.getByText("15.06.2024")).toBeVisible();

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

  it("passes dragReorder to the grid when albumId, reorder IPC, grid mode, and no quick filters", () => {
    const reorder = vi.fn().mockResolvedValue(undefined);
    renderGrid({
      albumItems: [item, itemB],
      albumId: "album-1",
      reorderAlbumMediaItem: reorder,
      viewMode: "grid",
    });

    expect(screen.getByTestId("trigger-reorder-move")).toBeVisible();
    fireEvent.click(screen.getByTestId("trigger-reorder-move"));

    expect(reorder).toHaveBeenCalledWith({
      albumId: "album-1",
      mediaItemId: "item-1",
      insertBeforeIndex: 2,
    });
  });

  it("offsets insertBeforeIndex by page when albumItemsPage > 0", () => {
    const reorder = vi.fn().mockResolvedValue(undefined);
    renderGrid({
      albumItems: [item, itemB],
      albumId: "album-1",
      albumItemsPage: 1,
      albumItemsTotal: 100,
      reorderAlbumMediaItem: reorder,
      viewMode: "grid",
    });

    fireEvent.click(screen.getByTestId("trigger-reorder-move"));

    expect(reorder).toHaveBeenCalledWith({
      albumId: "album-1",
      mediaItemId: "item-1",
      insertBeforeIndex: Math.min(ALBUM_ITEMS_PAGE_SIZE + 2, 100),
    });
  });

  it("does not pass dragReorder when quick filters are active", () => {
    renderGrid({
      albumItems: [item, itemB],
      albumId: "album-1",
      reorderAlbumMediaItem: vi.fn(),
      quickFilters: {
        ...DEFAULT_THUMBNAIL_QUICK_FILTERS,
        locationEnabled: true,
        locationQuery: "",
      },
    });

    expect(screen.queryByTestId("trigger-reorder-move")).toBeNull();
  });

  it("does not pass dragReorder without albumId", () => {
    renderGrid({
      albumItems: [item, itemB],
      reorderAlbumMediaItem: vi.fn(),
    });

    expect(screen.queryByTestId("trigger-reorder-move")).toBeNull();
  });

  it("does not pass dragReorder in list view", () => {
    renderGrid({
      albumItems: [item, itemB],
      albumId: "album-1",
      reorderAlbumMediaItem: vi.fn(),
      viewMode: "list",
    });

    expect(screen.queryByTestId("trigger-reorder-move")).toBeNull();
  });
});
