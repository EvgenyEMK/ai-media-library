// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { MediaAlbumSummary } from "@emk/shared-contracts";
import { DesktopStoreProvider } from "../stores/desktop-store";
import { DesktopMediaItemActionsMenu } from "./DesktopMediaItemActionsMenu";

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

const albums = [
  album("member", "Member Album"),
  album("recent", "Recent Album"),
  album("alpha", "Alpha Album"),
  album("beta", "Beta Album"),
  album("gamma", "Gamma Album"),
  album("delta", "Delta Album"),
];

function installDesktopApiMock(): Record<string, ReturnType<typeof vi.fn>> {
  const desktopApi = {
    listAlbums: vi.fn().mockResolvedValue({ rows: albums, totalCount: albums.length }),
    listAlbumsForMediaItem: vi
      .fn()
      .mockResolvedValueOnce([{ albumId: "member", title: "Member Album" }])
      .mockResolvedValue([{ albumId: "member", title: "Member Album" }, { albumId: "alpha", title: "Alpha Album" }]),
    addMediaItemsToAlbum: vi.fn().mockResolvedValue(undefined),
    removeMediaItemFromAlbum: vi.fn().mockResolvedValue(undefined),
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

function renderMenu(): void {
  render(
    <DesktopStoreProvider
      initialState={{
        albums,
        recentAlbumIds: ["recent"],
      }}
    >
      <DesktopMediaItemActionsMenu filePath="C:/photos/item.jpg" />
    </DesktopStoreProvider>,
  );
}

async function openAlbumsPanel(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTitle("Open media item actions"));
  fireEvent.click(await screen.findByRole("menuitem", { name: /Albums/ }));
  return screen.findByRole("menu");
}

describe("DesktopMediaItemActionsMenu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("orders album choices as member, recent, then remaining and caps at five", async () => {
    installDesktopApiMock();
    renderMenu();

    const menu = await openAlbumsPanel();
    await screen.findByPlaceholderText("Find album");

    const labels = within(menu)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter((label): label is string => Boolean(label) && label !== "Albums");

    expect(labels).toEqual([
      "Member Album",
      "Recent Album",
      "Alpha Album",
      "Beta Album",
      "Gamma Album",
    ]);
  });

  it("keeps the menu open and album order stable when toggling membership", async () => {
    const desktopApi = installDesktopApiMock();
    renderMenu();
    const menu = await openAlbumsPanel();
    await screen.findByPlaceholderText("Find album");

    fireEvent.click(within(menu).getByRole("button", { name: "Alpha Album" }));

    await waitFor(() =>
      expect(desktopApi.addMediaItemsToAlbum).toHaveBeenCalledWith("alpha", ["C:/photos/item.jpg"]),
    );
    expect(screen.getByPlaceholderText("Find album")).toBeVisible();
    expect(screen.queryByText(/Added to/)).toBeNull();
    const labels = within(menu)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter((label): label is string => Boolean(label) && label !== "Albums");
    expect(labels.slice(0, 3)).toEqual(["Member Album", "Recent Album", "Alpha Album"]);
  });

  it("returns to the main menu and resets on close", async () => {
    installDesktopApiMock();
    renderMenu();

    await openAlbumsPanel();
    fireEvent.click(screen.getByRole("menuitem", { name: /Albums/ }));
    expect(await screen.findByRole("menuitem", { name: "Reveal in File Explorer" })).toBeVisible();

    fireEvent.click(screen.getByRole("menuitem", { name: /Albums/ }));
    fireEvent.click(screen.getByLabelText("Close menu"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    fireEvent.click(screen.getByTitle("Open media item actions"));
    expect(await screen.findByRole("menuitem", { name: "Reveal in File Explorer" })).toBeVisible();
  });
});
