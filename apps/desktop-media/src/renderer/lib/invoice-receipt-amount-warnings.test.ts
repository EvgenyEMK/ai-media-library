import { describe, expect, it } from "vitest";
import {
  countFractionalDigits,
  formatInvoiceTotalDisplayParts,
  formatInvoiceVatDisplayParts,
  isInvoiceVatPercentMismatch,
  totalAmountNeedsDecimalWarning,
  vatAmountsWithinTenPercentRelative,
} from "./invoice-receipt-amount-warnings";

describe("invoice-receipt-amount-warnings", () => {
  it("countFractionalDigits trims trailing zeros in decimal part", () => {
    expect(countFractionalDigits(55.123)).toBe(3);
    expect(countFractionalDigits(10)).toBe(0);
    expect(countFractionalDigits(10.12)).toBe(2);
  });

  it("totalAmountNeedsDecimalWarning at three fractional digits", () => {
    expect(totalAmountNeedsDecimalWarning(55.123)).toBe(true);
    expect(totalAmountNeedsDecimalWarning(55.12)).toBe(false);
  });

  it("formatInvoiceTotalDisplayParts applies grouping and decimal warning cap", () => {
    const many = formatInvoiceTotalDisplayParts(1234567.123456, "EUR");
    expect(many.decimalPlacesWarning).toBe(true);
    expect(many.display).toMatch(/EUR$/);
  });

  it("isInvoiceVatPercentMismatch false for consistent inclusive VAT", () => {
    const total = 125;
    const pct = 25;
    const vat = total * (pct / (100 + pct));
    expect(isInvoiceVatPercentMismatch(total, pct, vat)).toBe(false);
  });

  it("isInvoiceVatPercentMismatch true for clearly wrong amount", () => {
    expect(isInvoiceVatPercentMismatch(100, 19, 50)).toBe(true);
  });

  it("isInvoiceVatPercentMismatch false when metadata VAT within 10% of exclusive model", () => {
    const total = 139.95;
    const pct = 20;
    const metadataVat = 29.95;
    const exclusiveCalc = total * (pct / 100);
    expect(exclusiveCalc).toBeCloseTo(27.99, 2);
    expect(isInvoiceVatPercentMismatch(total, pct, metadataVat)).toBe(false);
  });

  it("formatInvoiceVatDisplayParts hides decimal warning when percent mismatch", () => {
    const parts = formatInvoiceVatDisplayParts(100, 19, 50.123, "EUR");
    expect(parts.percentMismatch).toBe(true);
    expect(parts.decimalWarningOnAmount).toBe(false);
  });

  it("vatAmountsWithinTenPercentRelative matches user VAT example", () => {
    expect(vatAmountsWithinTenPercentRelative(27.99, 29.95)).toBe(true);
    expect(vatAmountsWithinTenPercentRelative(27.99, 35)).toBe(false);
  });

  it("formatInvoiceVatDisplayParts ok for consistent inclusive VAT row", () => {
    const vatOk = 125 * (25 / (100 + 25));
    const ok = formatInvoiceVatDisplayParts(125, 25, vatOk, "EUR");
    expect(ok.percentMismatch).toBe(false);
  });
});