import { describe, it, expect } from "vitest";
import { formatTimeLeftCompact, parseOptionalNumber } from "./eta-formatting";

describe("formatTimeLeftCompact", () => {
  it("formats seconds as minutes (ceiling)", () => {
    expect(formatTimeLeftCompact(45)).toBe("1min");
    expect(formatTimeLeftCompact(90)).toBe("2min");
  });

  it("formats exact minutes", () => {
    expect(formatTimeLeftCompact(60)).toBe("1min");
    expect(formatTimeLeftCompact(120)).toBe("2min");
  });

  it("formats hours only when minutes are zero", () => {
    expect(formatTimeLeftCompact(3600)).toBe("1h");
    expect(formatTimeLeftCompact(7200)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatTimeLeftCompact(3660)).toBe("1h1min");
    expect(formatTimeLeftCompact(5400)).toBe("1h30min");
  });

  it("does not show days at exactly 24h", () => {
    expect(formatTimeLeftCompact(24 * 3600)).toBe("24h");
  });

  it("shows days (Xd Yh Zmin) when exceeding 24h", () => {
    // 1d 12h 18min => 36h 18min
    const seconds = 36 * 3600 + 18 * 60;
    expect(formatTimeLeftCompact(seconds)).toBe("1d 12h 18min");
  });

  it("returns null for zero", () => {
    expect(formatTimeLeftCompact(0)).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(formatTimeLeftCompact(-10)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(formatTimeLeftCompact(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(formatTimeLeftCompact(Infinity)).toBeNull();
  });
});

describe("parseOptionalNumber", () => {
  it("parses valid numbers", () => {
    expect(parseOptionalNumber("42")).toBe(42);
    expect(parseOptionalNumber("3.14")).toBe(3.14);
  });

  it("returns undefined for empty string", () => {
    expect(parseOptionalNumber("")).toBeUndefined();
    expect(parseOptionalNumber("   ")).toBeUndefined();
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseOptionalNumber("abc")).toBeUndefined();
    expect(parseOptionalNumber("NaN")).toBeUndefined();
  });

  it("handles negative numbers", () => {
    expect(parseOptionalNumber("-5")).toBe(-5);
  });
});
