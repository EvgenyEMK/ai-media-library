import { describe, expect, it } from "vitest";
import { detectDefaultDateFormatFromLocale, formatDateByPreference } from "./date-display-format";

describe("formatDateByPreference", () => {
  it("formats YYYY-MM-DD", () => {
    expect(formatDateByPreference("2024-06-15T00:00:00Z", "YYYY-MM-DD")).toBe("2024-06-15");
  });

  it("formats DD.MM.YYYY", () => {
    expect(formatDateByPreference("2024-06-15T00:00:00Z", "DD.MM.YYYY")).toBe("15.06.2024");
  });

  it("formats MM/DD/YYYY", () => {
    expect(formatDateByPreference("2024-06-15T00:00:00Z", "MM/DD/YYYY")).toBe("06/15/2024");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateByPreference("bad-date", "DD.MM.YYYY")).toBe("");
  });
});

describe("detectDefaultDateFormatFromLocale", () => {
  it("detects month-first locale", () => {
    expect(detectDefaultDateFormatFromLocale("en-US")).toBe("MM/DD/YYYY");
  });

  it("detects year-first locale", () => {
    expect(detectDefaultDateFormatFromLocale("sv-SE")).toBe("YYYY-MM-DD");
  });

  it("falls back to DD.MM.YYYY on unknown locale", () => {
    expect(detectDefaultDateFormatFromLocale("")).toBe("DD.MM.YYYY");
  });
});
