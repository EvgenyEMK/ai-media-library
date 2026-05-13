import type { InvoiceReceiptDocumentRow } from "../../shared/ipc";

/** Placeholder catalog rows when the library has no `invoice_or_receipt` items yet. */
export const INVOICE_RECEIPT_SAMPLE_ROWS: readonly InvoiceReceiptDocumentRow[] = [
  {
    id: "__sample-1",
    sourcePath: "",
    filename: "receipt-cafe-example.png",
    mediaKind: "image",
    issuer: "Café Solstice",
    invoiceDate: "2025-03-14",
    totalAmount: 24.5,
    currency: "EUR",
    vatPercent: 7.7,
    vatAmount: 1.76,
  },
  {
    id: "__sample-2",
    sourcePath: "",
    filename: "invoice-studio-example.pdf.png",
    mediaKind: "image",
    issuer: "Northwind Design Studio AG",
    invoiceDate: "2025-02-01",
    totalAmount: 1180,
    currency: "CHF",
    vatPercent: 8.1,
    vatAmount: 88.44,
  },
  {
    id: "__sample-3",
    sourcePath: "",
    filename: "receipt-market-example.png",
    mediaKind: "image",
    issuer: "City Market Co-op",
    invoiceDate: "2025-01-22",
    totalAmount: 63.2,
    currency: "USD",
    vatPercent: null,
    vatAmount: null,
  },
];

export function isInvoiceReceiptSampleRowId(id: string): boolean {
  return id.startsWith("__sample-");
}
