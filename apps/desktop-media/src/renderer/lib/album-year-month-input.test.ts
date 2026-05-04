import { describe, expect, it } from "vitest";
import {
  ALBUM_YEAR_MONTH_INPUT_HINT,
  ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER,
  sanitizeAlbumYearMonthDigitsInput,
} from "./album-year-month-input";

describe("sanitizeAlbumYearMonthDigitsInput", () => {
  it("strips non-digits and caps length", () => {
    expect(sanitizeAlbumYearMonthDigitsInput("20x24-0a1")).toBe("2024-01");
  });

  it("allows year only", () => {
    expect(sanitizeAlbumYearMonthDigitsInput("2024")).toBe("2024");
  });

  it("inserts hyphen after four digits when month digits follow", () => {
    expect(sanitizeAlbumYearMonthDigitsInput("202406")).toBe("2024-06");
  });

  it("rejects invalid first month digit", () => {
    expect(sanitizeAlbumYearMonthDigitsInput("202492")).toBe("2024");
  });

  it("rejects invalid two-digit month", () => {
    expect(sanitizeAlbumYearMonthDigitsInput("202413")).toBe("2024-1");
  });

  it("exposes placeholder and hint constants", () => {
    expect(ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER).toBe("YYYY-MM");
    expect(ALBUM_YEAR_MONTH_INPUT_HINT).toBe("YYYY or YYYY-MM");
  });
});
