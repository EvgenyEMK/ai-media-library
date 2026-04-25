// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MediaItemActionsMenu } from "./media-item-actions-menu";

describe("MediaItemActionsMenu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders menu content in a portal and closes on outside click", async () => {
    const onOpenChange = vi.fn();
    render(
      <MediaItemActionsMenu
        onOpenChange={onOpenChange}
        actions={[{ id: "copy", label: "Copy" }]}
      />,
    );

    fireEvent.click(screen.getByTitle("Open media item actions"));

    expect(await screen.findByRole("menu")).toBeVisible();
    expect(document.body).toContainElement(screen.getByRole("menu"));

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the menu open when closeOnSelect is false and renders custom content", async () => {
    const onSelect = vi.fn();
    render(
      <MediaItemActionsMenu
        actions={[{ id: "albums", label: "Albums", closeOnSelect: false, onSelect }]}
        renderContent={() => <div>Nested content</div>}
      />,
    );

    fireEvent.click(screen.getByTitle("Open media item actions"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Albums" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeVisible();
    expect(screen.getByText("Nested content")).toBeVisible();
  });

  it("closes on Escape", async () => {
    render(<MediaItemActionsMenu actions={[{ id: "copy", label: "Copy" }]} />);

    fireEvent.click(screen.getByTitle("Open media item actions"));
    expect(await screen.findByRole("menu")).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
