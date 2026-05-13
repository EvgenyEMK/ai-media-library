import { describe, expect, it } from "vitest";
import { sanitizeInvoiceIsoDateDraft } from "./invoice-receipt-date-draft";

describe("sanitizeInvoiceIsoDateDraft", () => {
  it("limits year to four digits and builds segments", () => {
    expect(sanitizeInvoiceIsoDateDraft("20240115")).toBe("2024-01-15");
    expect(sanitizeInvoiceIsoDateDraft("2024-01-15")).toBe("2024-01-15");
  });

  it("strips non-digits", () => {
    expect(sanitizeInvoiceIsoDateDraft("20xx24-01-15")).toBe("2024-01-15");
  });
});
