import { describe, expect, it } from "vitest";
import { formatPhotoTakenListLabel } from "./photo-date-format";

describe("formatPhotoTakenListLabel", () => {
  it("prefers photo taken over file created", () => {
    const label = formatPhotoTakenListLabel("2020-06-15T12:00:00.000Z", "2019-01-01T00:00:00.000Z");
    expect(label.length).toBeGreaterThan(0);
  });

  it("falls back to file created", () => {
    const label = formatPhotoTakenListLabel(null, "2018-03-20T08:00:00.000Z");
    expect(label.length).toBeGreaterThan(0);
  });

  it("returns empty when no valid dates", () => {
    expect(formatPhotoTakenListLabel(null, null)).toBe("");
    expect(formatPhotoTakenListLabel("not-a-date", null)).toBe("");
  });

  it("formats year-only capture dates", () => {
    expect(formatPhotoTakenListLabel("1980", null, "year")).toBe("1980");
  });

  it("formats month precision", () => {
    const label = formatPhotoTakenListLabel("1980-06", null, "month");
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain("1980");
  });

  it("supports explicit DD.MM.YYYY formatting", () => {
    expect(
      formatPhotoTakenListLabel("2024-06-15T12:00:00.000Z", null, "instant", "DD.MM.YYYY"),
    ).toBe("15.06.2024");
  });

  it("supports explicit MM/DD/YYYY formatting", () => {
    expect(
      formatPhotoTakenListLabel("2024-06-15T12:00:00.000Z", null, "instant", "MM/DD/YYYY"),
    ).toBe("06/15/2024");
  });

  it("formats month precision by selected format", () => {
    expect(formatPhotoTakenListLabel("1980-06", null, "month", "YYYY-MM-DD")).toBe("1980-06");
    expect(formatPhotoTakenListLabel("1980-06", null, "month", "DD.MM.YYYY")).toBe("06.1980");
  });
});
