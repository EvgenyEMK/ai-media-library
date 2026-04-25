// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { MediaAlbumSummary } from "@emk/shared-contracts";
import { DesktopAlbumCard } from "./DesktopAlbumCard";

function album(overrides: Partial<MediaAlbumSummary> = {}): MediaAlbumSummary {
  return {
    id: "album-1",
    title: "Wakeboard",
    description: null,
    coverMediaItemId: null,
    coverSourcePath: null,
    coverImageUrl: null,
    coverMediaKind: "image",
    mediaCount: 2,
    locationSummary: "Croatia, Split",
    personTags: [{ id: "tag-1", label: "Alice", source: "direct" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DesktopAlbumCard", () => {
  afterEach(cleanup);

  it("renders album metadata and image cover", () => {
    const { container } = render(
      <DesktopAlbumCard album={album({ coverImageUrl: "file:///cover.jpg" })} selected={false} onClick={vi.fn()} />,
    );

    expect(screen.getByText("Wakeboard")).toBeVisible();
    expect(screen.getByText("2 items · Croatia, Split")).toBeVisible();
    expect(screen.getByText("Alice")).toBeVisible();
    expect(container.querySelector("img")).toHaveAttribute("src", "file:///cover.jpg");
  });

  it("renders a video cover when the album cover is a video", () => {
    const { container } = render(
      <DesktopAlbumCard
        album={album({ coverImageUrl: "file:///cover.mp4", coverMediaKind: "video" })}
        selected={false}
        onClick={vi.fn()}
      />,
    );

    expect(container.querySelector("video")).toHaveAttribute("src", "file:///cover.mp4");
  });

  it("uses a photo placeholder icon when there is no cover", () => {
    const { container } = render(<DesktopAlbumCard album={album()} selected onClick={vi.fn()} />);

    expect(screen.queryByText("No cover")).toBeNull();
    expect(container.querySelector("svg[viewBox='0 0 72 72']")).not.toBeNull();
    expect(screen.getByRole("button")).toHaveClass("border-primary");
  });
});
