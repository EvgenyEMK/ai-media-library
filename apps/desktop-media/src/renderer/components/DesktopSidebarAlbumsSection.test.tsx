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
  expandRecentAlbumsByDefault?: boolean;
  onAlbumSelected?: () => void;
  onSmartAlbumSelected?: (
    kind: "country-year-area" | "country-area-city" | "ai-countries" | "best-of-year"
  ) => void;
  onShowAlbumList?: () => void;
  highlightedSmartAlbumKind?: "country-year-area" | "country-area-city" | "ai-countries" | "best-of-year" | null;
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
        expandRecentAlbumsByDefault={options.expandRecentAlbumsByDefault}
        onAlbumSelected={options.onAlbumSelected}
        onSmartAlbumSelected={options.onSmartAlbumSelected}
        onShowAlbumList={options.onShowAlbumList}
        highlightedSmartAlbumKind={options.highlightedSmartAlbumKind ?? null}
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

  it("shows search at top and hides album picks until the user types a query when there are no recent albums", async () => {
    renderSection({ albums: [album("album-a", "Alpha"), album("album-b", "Beta")] });

    expect(await screen.findByPlaceholderText("Search albums")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
  });

  it("lists search matches while recent albums stay visible", async () => {
    renderSection({
      albums: [album("album-a", "Alpha"), album("album-b", "Beta")],
      recentAlbumIds: ["album-b"],
    });

    expect(await screen.findByPlaceholderText("Search albums")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "RECENT" }));
    expect(await screen.findByRole("button", { name: "Beta" })).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("Search albums"), { target: { value: "alp" } });

    expect(screen.getByRole("button", { name: "Alpha" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Beta" })).toBeVisible();
  });

  it("keeps visible Recent order stable after selecting an album", async () => {
    const onAlbumSelected = vi.fn();
    renderSection({
      albums: [album("album-a", "Alpha"), album("album-b", "Beta")],
      recentAlbumIds: ["album-a", "album-b"],
      onAlbumSelected,
    });
    expect(await screen.findByPlaceholderText("Search albums")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "RECENT" }));
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

    fireEvent.click(await screen.findByRole("button", { name: "ALL ALBUMS" }));
    await waitFor(() => expect(onShowAlbumList).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText("Search albums"), { target: { value: "alp" } });
    fireEvent.click(screen.getByTestId("desktop-sidebar-album-search-album-a"));

    expect(onAlbumSelected).toHaveBeenCalledTimes(1);
  });

  it("starts with RECENT collapsed when there are recent albums", async () => {
    renderSection({
      albums: [album("album-a", "Alpha")],
      recentAlbumIds: ["album-a"],
    });

    expect(await screen.findByPlaceholderText("Search albums")).toBeVisible();
    const recentToggle = screen.getByRole("button", { name: "RECENT" });
    expect(recentToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
  });

  it("honors expandRecentAlbumsByDefault for initial RECENT state", async () => {
    renderSection({
      albums: [album("album-a", "Alpha")],
      recentAlbumIds: ["album-a"],
      expandRecentAlbumsByDefault: true,
    });

    expect(await screen.findByRole("button", { name: "Alpha" })).toBeVisible();
    expect(screen.getByRole("button", { name: "RECENT" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows smart album shortcuts below the existing album sections", async () => {
    const onSmartAlbumSelected = vi.fn();
    renderSection({
      albums: [album("album-a", "Alpha")],
      recentAlbumIds: ["album-a"],
      onSmartAlbumSelected,
    });

    fireEvent.click(await screen.findByRole("button", { name: "SMART ALBUMS" }));
    fireEvent.click(screen.getByRole("button", { name: "Country > Year > Area" }));
    fireEvent.click(screen.getByRole("button", { name: "Country > Area > City" }));
    fireEvent.click(screen.getByRole("button", { name: "Best of Year" }));

    expect(onSmartAlbumSelected).toHaveBeenNthCalledWith(1, "country-year-area");
    expect(onSmartAlbumSelected).toHaveBeenNthCalledWith(2, "country-area-city");
    expect(onSmartAlbumSelected).toHaveBeenNthCalledWith(3, "best-of-year");
  });

  it("lists ALL ALBUMS before SMART ALBUMS in the sidebar", async () => {
    renderSection({ albums: [album("album-a", "Alpha")] });
    const allHeader = await screen.findByRole("button", { name: "ALL ALBUMS" });
    const smartHeader = screen.getByRole("button", { name: "SMART ALBUMS" });
    expect(allHeader.compareDocumentPosition(smartHeader) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("highlights the active smart album when highlightedSmartAlbumKind is set", async () => {
    renderSection({
      albums: [album("album-a", "Alpha")],
      highlightedSmartAlbumKind: "best-of-year",
    });
    fireEvent.click(await screen.findByRole("button", { name: "SMART ALBUMS" }));
    const bestOfYearRow = screen.getByRole("button", { name: "Best of Year" });
    expect(bestOfYearRow).toHaveClass("bg-primary/10");
    expect(bestOfYearRow).toHaveClass("border-primary");
  });
});
