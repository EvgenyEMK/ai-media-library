// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from "vitest";
import type { DragEvent } from "react";
import {
  cleanupReorderDragPreview,
  installReorderDragPreview,
  REORDER_DRAG_PREVIEW_OPACITY,
} from "./reorder-drag-preview";

afterEach(() => {
  document.body.querySelectorAll("[data-emk-reorder-drag-preview]").forEach((el) => el.remove());
});

describe("installReorderDragPreview", () => {
  it("uses setDragImage with a semi-opaque bordered ghost when img is not decoded (div fallback)", () => {
    const card = document.createElement("div");
    const img = document.createElement("img");
    img.src = "https://example.com/photo.jpg";
    Object.defineProperty(img, "complete", { value: false, configurable: true });
    card.appendChild(img);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 96,
      left: 10,
      top: 20,
      right: 130,
      bottom: 116,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });

    const ghostRef: { current: HTMLDivElement | null } = { current: null };
    const setDragImage = vi.fn();
    const event = {
      clientX: 40,
      clientY: 50,
      dataTransfer: { setDragImage },
    } as unknown as DragEvent<HTMLDivElement>;

    installReorderDragPreview(event, card, ghostRef);

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = document.body.querySelector("[data-emk-reorder-drag-preview]");
    expect(ghost).toBeTruthy();
    expect((ghost as HTMLElement).style.opacity).toBe(String(REORDER_DRAG_PREVIEW_OPACITY));
    expect((ghost as HTMLElement).style.border).toContain("255");

    cleanupReorderDragPreview(ghostRef);
    expect(document.body.querySelector("[data-emk-reorder-drag-preview]")).toBeNull();
  });

  it("falls back to imageUrl when the card has no media node yet", () => {
    const card = document.createElement("div");
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      width: 80,
      height: 64,
      left: 0,
      top: 0,
      right: 80,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const ghostRef: { current: HTMLDivElement | null } = { current: null };
    const event = {
      clientX: 5,
      clientY: 5,
      dataTransfer: { setDragImage: vi.fn() },
    } as unknown as DragEvent<HTMLDivElement>;

    installReorderDragPreview(event, card, ghostRef, {
      imageUrl: "file:///tmp/x.jpg",
      mediaType: "image",
    });

    const ghost = document.body.querySelector("[data-emk-reorder-drag-preview]");
    expect(ghost?.querySelector("img")?.getAttribute("src")).toBe("file:///tmp/x.jpg");
    cleanupReorderDragPreview(ghostRef);
  });
});
