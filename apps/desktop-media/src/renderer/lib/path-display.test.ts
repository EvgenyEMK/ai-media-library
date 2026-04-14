import { describe, expect, it } from "vitest";
import { parentPathWithTrailingSep } from "./path-display";

describe("parentPathWithTrailingSep", () => {
  it("returns Windows-style parent with trailing backslash", () => {
    expect(parentPathWithTrailingSep("C:\\photos\\vacations\\img.jpg")).toBe("C:\\photos\\vacations\\");
  });

  it("returns drive root for file in drive root", () => {
    expect(parentPathWithTrailingSep("C:\\file.jpg")).toBe("C:\\");
  });

  it("returns POSIX parent with trailing slash", () => {
    expect(parentPathWithTrailingSep("/home/user/photo.jpg")).toBe("/home/user/");
  });

  it("returns empty when there is no directory segment", () => {
    expect(parentPathWithTrailingSep("photo.jpg")).toBe("");
  });
});
