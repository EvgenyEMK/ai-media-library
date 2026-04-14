import { describe, it, expect } from "vitest";
import { peoplePaginationTotalPages } from "../lib/people-pagination-total-pages";

describe("peoplePaginationTotalPages", () => {
  it("returns 1 for empty or single page", () => {
    expect(peoplePaginationTotalPages(0, 25)).toBe(1);
    expect(peoplePaginationTotalPages(10, 25)).toBe(1);
    expect(peoplePaginationTotalPages(25, 25)).toBe(1);
  });

  it("rounds up for partial last page", () => {
    expect(peoplePaginationTotalPages(26, 25)).toBe(2);
    expect(peoplePaginationTotalPages(50, 25)).toBe(2);
    expect(peoplePaginationTotalPages(51, 25)).toBe(3);
  });
});
