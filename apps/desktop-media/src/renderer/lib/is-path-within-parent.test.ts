import { describe, expect, it } from "vitest";
import { isPathWithinParent } from "./is-path-within-parent";

describe("isPathWithinParent", () => {
  it("returns true for identical paths", () => {
    expect(isPathWithinParent("C:\\Photos", "C:\\Photos")).toBe(true);
    expect(isPathWithinParent("/home/user/pics", "/home/user/pics")).toBe(true);
  });

  it("returns true when target is a direct child", () => {
    expect(isPathWithinParent("C:\\Photos\\2024", "C:\\Photos")).toBe(true);
    expect(isPathWithinParent("/home/user/pics/vacation", "/home/user/pics")).toBe(true);
  });

  it("returns true for nested descendants", () => {
    expect(isPathWithinParent("C:\\Photos\\a\\b\\c.jpg", "C:\\Photos")).toBe(true);
  });

  it("returns false for sibling or unrelated paths", () => {
    expect(isPathWithinParent("C:\\Music", "C:\\Photos")).toBe(false);
    expect(isPathWithinParent("/home/user/docs", "/home/user/pics")).toBe(false);
  });

  it("does not treat path prefix as parent when only a partial segment matches", () => {
    expect(isPathWithinParent("C:\\PhotosBackup", "C:\\Photos")).toBe(false);
  });

  it("normalizes mixed slashes", () => {
    expect(isPathWithinParent("C:/Photos\\\\sub", "C:\\Photos")).toBe(true);
  });
});
