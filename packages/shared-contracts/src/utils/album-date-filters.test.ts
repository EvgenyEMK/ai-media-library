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

  it("uses the correct end day for non-leap February", () => {
    expect(parseAlbumYearMonthBound("2023-02", "end")).toBe("2023-02-28T23:59:59.999Z");
  });

  it("trims whitespace before parsing bounds", () => {
    expect(parseAlbumYearMonthBound(" 2026-04 ", "start")).toBe("2026-04-01");
  });

  it("rejects invalid months and non-matching values", () => {
    expect(parseAlbumYearMonthBound("2024-00", "start")).toBeUndefined();
    expect(parseAlbumYearMonthBound("2024-13", "end")).toBeUndefined();
    expect(parseAlbumYearMonthBound("summer", "start")).toBeUndefined();
  });

  it("ignores invalid values", () => {
    expect(normalizeAlbumDateBounds({ yearMonthFrom: "2024-13", yearMonthTo: "summer" })).toEqual(
      {},
    );
  });

  it("normalizes one-sided and complete date ranges", () => {
    expect(normalizeAlbumDateBounds({ yearMonthFrom: "2024" })).toEqual({
      start: "2024-01-01",
    });
    expect(normalizeAlbumDateBounds({ yearMonthTo: "2024-03" })).toEqual({
      end: "2024-03-31T23:59:59.999Z",
    });
    expect(normalizeAlbumDateBounds({ yearMonthFrom: "2024-02", yearMonthTo: "2024-03" })).toEqual({
      start: "2024-02-01",
      end: "2024-03-31T23:59:59.999Z",
    });
  });
});
