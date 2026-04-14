import { describe, expect, it } from "vitest";
import {
  hasStarRatingToClear,
  shouldShowRejectedBadge,
  shouldShowStarCompactBadge,
} from "./media-item-star-rating";

describe("hasStarRatingToClear", () => {
  it("is false when unrated or unset", () => {
    expect(hasStarRatingToClear(null, false)).toBe(false);
    expect(hasStarRatingToClear(undefined, false)).toBe(false);
    expect(hasStarRatingToClear(0, false)).toBe(false);
  });

  it("is true for 1–5 stars", () => {
    expect(hasStarRatingToClear(1, false)).toBe(true);
    expect(hasStarRatingToClear(5, false)).toBe(true);
  });

  it("is true for rejected only when indicator is on", () => {
    expect(hasStarRatingToClear(-1, false)).toBe(false);
    expect(hasStarRatingToClear(-1, true)).toBe(true);
  });
});

describe("shouldShowStarCompactBadge / shouldShowRejectedBadge", () => {
  it("compact badge only for 1–5", () => {
    expect(shouldShowStarCompactBadge(0)).toBe(false);
    expect(shouldShowStarCompactBadge(3)).toBe(true);
  });

  it("rejected badge when -1 and flag", () => {
    expect(shouldShowRejectedBadge(-1, true)).toBe(true);
    expect(shouldShowRejectedBadge(-1, false)).toBe(false);
  });
});
