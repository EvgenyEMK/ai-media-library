import { describe, expect, it } from "vitest";
import { computeAgeYearsAt, resolvePersonAgeYearsForMedia } from "./person-age";

describe("computeAgeYearsAt", () => {
  it("computes age on birthday", () => {
    expect(computeAgeYearsAt("2000-06-15", "2020-06-15")).toBe(20);
  });

  it("computes age day before birthday", () => {
    expect(computeAgeYearsAt("2000-06-15", "2020-06-14")).toBe(19);
  });

  it("handles leap-day birth against non-leap reference", () => {
    expect(computeAgeYearsAt("2000-02-29", "2021-02-28")).toBe(20);
  });

  it("returns null when reference is before birth", () => {
    expect(computeAgeYearsAt("2010-01-01", "2009-12-31")).toBe(null);
  });

  it("returns null when inputs missing", () => {
    expect(computeAgeYearsAt(null, "2020-01-01")).toBe(null);
    expect(computeAgeYearsAt("2000-01-01", null)).toBe(null);
  });

  it("parses ISO datetime prefix as calendar date", () => {
    expect(computeAgeYearsAt("2000-01-01", "2025-07-04T12:00:00.000Z")).toBe(25);
  });
});

describe("resolvePersonAgeYearsForMedia", () => {
  it("uses birth date when media event date is present", () => {
    expect(
      resolvePersonAgeYearsForMedia({
        birthDate: "2010-05-01",
        mediaEventDate: "2020-05-01",
        estimatedAgeYears: 5,
      }),
    ).toEqual({ years: 10, source: "birth_date" });
  });

  it("falls back to estimated age when birth or event date missing", () => {
    expect(
      resolvePersonAgeYearsForMedia({
        birthDate: "2010-05-01",
        mediaEventDate: null,
        estimatedAgeYears: 12.4,
      }),
    ).toEqual({ years: 12, source: "estimated_age_years" });
  });

  it("falls back when birth date present but event before birth", () => {
    expect(
      resolvePersonAgeYearsForMedia({
        birthDate: "2010-05-01",
        mediaEventDate: "2005-01-01",
        estimatedAgeYears: 8,
      }),
    ).toEqual({ years: 8, source: "estimated_age_years" });
  });

  it("returns null when nothing usable", () => {
    expect(
      resolvePersonAgeYearsForMedia({
        birthDate: null,
        mediaEventDate: "2020-01-01",
        estimatedAgeYears: null,
      }),
    ).toBe(null);
  });
});
