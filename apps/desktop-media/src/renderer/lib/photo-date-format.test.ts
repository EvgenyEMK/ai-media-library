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
});
