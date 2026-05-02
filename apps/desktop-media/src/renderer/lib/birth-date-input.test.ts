import { describe, expect, it } from "vitest";
import { formatIsoDateInput, isValidIsoDateString } from "./birth-date-input";

describe("formatIsoDateInput", () => {
  it("formats digit runs into YYYY-MM-DD segments", () => {
    expect(formatIsoDateInput("19950315")).toBe("1995-03-15");
    expect(formatIsoDateInput("1995")).toBe("1995");
    expect(formatIsoDateInput("199503")).toBe("1995-03");
  });

  it("strips non-digits", () => {
    expect(formatIsoDateInput("1995-03-15")).toBe("1995-03-15");
    expect(formatIsoDateInput("19a9b5c0d3e15")).toBe("1995-03-15");
  });

  it("caps at 8 digits", () => {
    expect(formatIsoDateInput("1995031599")).toBe("1995-03-15");
  });
});

describe("isValidIsoDateString", () => {
  it("accepts valid calendar dates", () => {
    expect(isValidIsoDateString("1995-03-15")).toBe(true);
    expect(isValidIsoDateString("2000-01-01")).toBe(true);
    expect(isValidIsoDateString("2024-02-29")).toBe(true);
  });

  it("rejects invalid format or impossible dates", () => {
    expect(isValidIsoDateString("")).toBe(false);
    expect(isValidIsoDateString("95-03-15")).toBe(false);
    expect(isValidIsoDateString("1995-3-15")).toBe(false);
    expect(isValidIsoDateString("1995-02-30")).toBe(false);
    expect(isValidIsoDateString("not-a-date")).toBe(false);
  });
});
