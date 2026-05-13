import { describe, expect, it } from "vitest";
import { countActiveInvoiceFilters } from "./invoice-receipt-filter-count";

describe("countActiveInvoiceFilters", () => {
  it("counts set fields", () => {
    expect(
      countActiveInvoiceFilters({
        issuedBy: "x",
        dateFrom: "2024-01-01",
        totalFrom: 1,
        currency: "EUR",
      }),
    ).toBe(4);
  });

  it("ignores empty strings and non-finite totals", () => {
    expect(countActiveInvoiceFilters({ issuedBy: "  ", totalFrom: Number.NaN })).toBe(0);
  });
});
