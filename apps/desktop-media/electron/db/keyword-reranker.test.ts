import { describe, it, expect } from "vitest";
import { compareKeywordRerankRows } from "./keyword-reranker";

describe("compareKeywordRerankRows", () => {
  it("orders by keyword hits descending first", () => {
    const a = { keywordHits: 1, score: 0.99 };
    const b = { keywordHits: 3, score: 0.01 };
    expect(compareKeywordRerankRows(a, b)).toBeGreaterThan(0);
    expect(compareKeywordRerankRows(b, a)).toBeLessThan(0);
  });

  it("uses RRF score descending as tie-breaker when hit counts match", () => {
    const a = { keywordHits: 2, score: 0.05 };
    const b = { keywordHits: 2, score: 0.08 };
    expect(compareKeywordRerankRows(a, b)).toBeGreaterThan(0);
    expect(compareKeywordRerankRows(b, a)).toBeLessThan(0);
  });
});
