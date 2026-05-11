import { describe, expect, it } from "vitest";
import { formatImageSimilarityPercent } from "./format-image-similarity-percent";

describe("formatImageSimilarityPercent", () => {
  it("returns dash for nullish or NaN", () => {
    expect(formatImageSimilarityPercent(null)).toBe("—");
    expect(formatImageSimilarityPercent(undefined)).toBe("—");
    expect(formatImageSimilarityPercent(Number.NaN)).toBe("—");
  });

  it("rounds to whole percent", () => {
    expect(formatImageSimilarityPercent(0.895)).toBe("90%");
    expect(formatImageSimilarityPercent(0.894)).toBe("89%");
    expect(formatImageSimilarityPercent(0)).toBe("0%");
  });

  it("shows 100% only when score is 1", () => {
    expect(formatImageSimilarityPercent(1)).toBe("100%");
    expect(formatImageSimilarityPercent(0.999)).toBe("99%");
    expect(formatImageSimilarityPercent(0.995)).toBe("99%");
  });

  it("clamps out-of-range values", () => {
    expect(formatImageSimilarityPercent(-0.1)).toBe("0%");
    expect(formatImageSimilarityPercent(1.2)).toBe("100%");
  });
});
