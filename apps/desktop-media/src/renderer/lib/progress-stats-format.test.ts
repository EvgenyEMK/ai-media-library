import { describe, it, expect } from "vitest";
import { formatCount, formatCountRatio } from "./progress-stats-format";

describe("formatCount", () => {
  it("adds apostrophe thousand separator", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(2000)).toBe("2'000");
    expect(formatCount(35040)).toBe("35'040");
  });

  it("handles non-finite and decimals", () => {
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatCount(1234.9)).toBe("1'234");
    expect(formatCount(-1234.9)).toBe("-1'234");
  });
});

describe("formatCountRatio", () => {
  it("formats as `${a} / ${b}`", () => {
    expect(formatCountRatio(2000, 35040)).toBe("2'000 / 35'040");
  });
});

