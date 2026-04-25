import { describe, expect, it } from "vitest";
import { normalizeAlbumDateBounds, parseAlbumYearMonthBound } from "./album-date-filters";

describe("album date filter helpers", () => {
  it("expands YYYY bounds", () => {
    expect(parseAlbumYearMonthBound("2024", "start")).toBe("2024-01-01");
    expect(parseAlbumYearMonthBound("2024", "end")).toBe("2024-12-31T23:59:59.999Z");
  });

  it("expands YYYY-MM bounds", () => {
    expect(parseAlbumYearMonthBound("2024-02", "start")).toBe("2024-02-01");
    expect(parseAlbumYearMonthBound("2024-02", "end")).toBe("2024-02-29T23:59:59.999Z");
  });

  it("ignores invalid values", () => {
    expect(normalizeAlbumDateBounds({ yearMonthFrom: "2024-13", yearMonthTo: "summer" })).toEqual(
      {},
    );
  });
});
