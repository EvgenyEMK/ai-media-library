import { describe, it, expect } from "vitest";
import { clamp } from "./math";

describe("clamp", () => {
  it("returns the value when within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min when value is below", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to max when value is above", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns min when min equals max and value differs", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("handles negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(0, -10, -1)).toBe(-1);
    expect(clamp(-20, -10, -1)).toBe(-10);
  });

  it("returns boundary when value equals boundary", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("handles fractional values", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(1.5, 0, 1)).toBe(1);
  });
});
