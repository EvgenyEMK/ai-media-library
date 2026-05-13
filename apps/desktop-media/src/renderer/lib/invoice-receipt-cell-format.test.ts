import { describe, expect, it } from "vitest";
import { formatInvoiceTotalCell, formatInvoiceVatCell } from "./invoice-receipt-cell-format";

describe("invoice-receipt-cell-format", () => {
  it("formatInvoiceTotalCell shows amount and currency", () => {
    expect(formatInvoiceTotalCell(42.5, "EUR")).toBe("42.5 EUR");
  });

  it("formatInvoiceTotalCell handles missing values", () => {
    expect(formatInvoiceTotalCell(null, "EUR")).toBe("—");
    expect(formatInvoiceTotalCell(10, null)).toBe("10");
  });

  it("formatInvoiceVatCell combines percent and amount", () => {
    expect(formatInvoiceVatCell(19, 3.8, "EUR")).toBe("19% (3.8 EUR)");
  });

  it("formatInvoiceVatCell falls back when amount missing", () => {
    expect(formatInvoiceVatCell(8, null, "CHF")).toBe("8%");
  });
});
