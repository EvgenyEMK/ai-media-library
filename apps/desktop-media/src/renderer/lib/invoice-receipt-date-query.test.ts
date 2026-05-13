import { describe, expect, it } from "vitest";
import {
  normalizeInvoiceDateFromForQuery,
  normalizeInvoiceDateToForQuery,
} from "./invoice-receipt-date-query";

describe("invoice-receipt-date-query", () => {
  it("normalizes date-from: year, year-month, full day", () => {
    expect(normalizeInvoiceDateFromForQuery("2025")).toBe("2025-01-01");
    expect(normalizeInvoiceDateFromForQuery("2025-03")).toBe("2025-03-01");
    expect(normalizeInvoiceDateFromForQuery("2025-03-10")).toBe("2025-03-10");
  });

  it("normalizes date-to: year, year-month, full day", () => {
    expect(normalizeInvoiceDateToForQuery("2025")).toBe("2025-12-31");
    expect(normalizeInvoiceDateToForQuery("2025-02")).toBe("2025-02-28");
    expect(normalizeInvoiceDateToForQuery("2024-02")).toBe("2024-02-29");
    expect(normalizeInvoiceDateToForQuery("2025-03-10")).toBe("2025-03-10");
  });

  it("returns null for invalid or empty input", () => {
    expect(normalizeInvoiceDateFromForQuery("")).toBe(null);
    expect(normalizeInvoiceDateFromForQuery("202")).toBe(null);
    expect(normalizeInvoiceDateToForQuery("2025-13")).toBe(null);
  });
});
