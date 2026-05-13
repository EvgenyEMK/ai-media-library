import { describe, it, expect } from "vitest";
import { isMediaPathInsideSelectionDiskTree } from "./duplicate-files-folder-scope";

describe("duplicate-files-folder-scope", () => {
  it("isMediaPathInsideSelectionDiskTree treats selection path as disk tree root", () => {
    expect(isMediaPathInsideSelectionDiskTree("/photos/trip/a.jpg", "/photos/trip")).toBe(true);
    expect(isMediaPathInsideSelectionDiskTree("/photos/trip/nested/b.jpg", "/photos/trip")).toBe(true);
    expect(isMediaPathInsideSelectionDiskTree("/photos/other/b.jpg", "/photos/trip")).toBe(false);
    expect(isMediaPathInsideSelectionDiskTree("/photos/trip", "/photos/trip")).toBe(true);
  });
});
