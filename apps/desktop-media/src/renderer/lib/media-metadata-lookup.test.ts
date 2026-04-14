import { describe, expect, it } from "vitest";

import { comparableFilePath, lookupMediaMetadataByItemId } from "./media-metadata-lookup";

describe("comparableFilePath", () => {
  it("normalizes backslashes and duplicate slashes", () => {
    expect(comparableFilePath("C:\\a\\\\b//c.jpg")).toBe("C:/a/b/c.jpg");
  });
});

describe("lookupMediaMetadataByItemId", () => {
  it("finds exact key", () => {
    const meta = { id: "1" };
    const map: Record<string, unknown> = { "C:\\a\\b.jpg": meta };
    expect(lookupMediaMetadataByItemId("C:\\a\\b.jpg", map)).toBe(meta);
  });

  it("matches when lookup uses slashes and map uses backslashes", () => {
    const meta = { id: "1" };
    const map: Record<string, unknown> = { "C:\\Photos\\x.jpg": meta };
    expect(lookupMediaMetadataByItemId("C:/Photos/x.jpg", map)).toBe(meta);
  });

  it("matches case-insensitively when keys differ only by case", () => {
    const meta = { id: "1" };
    const map: Record<string, unknown> = { "c:\\photos\\A.JPG": meta };
    expect(lookupMediaMetadataByItemId("C:\\photos\\a.jpg", map)).toBe(meta);
  });

  it("returns undefined for empty itemId", () => {
    expect(lookupMediaMetadataByItemId("", { a: 1 })).toBeUndefined();
  });
});
