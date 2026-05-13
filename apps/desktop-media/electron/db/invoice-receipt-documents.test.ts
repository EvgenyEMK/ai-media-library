import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

function canOpenSqlite(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as new (p: string) => { close: () => void };
    const db = new Database(":memory:");
    db.close();
    return true;
  } catch {
    return false;
  }
}

const HAS_SQLITE = canOpenSqlite();
const LIBRARY_ID = "local-default";

type ClientModule = typeof import("./client");
type InvoiceModule = typeof import("./invoice-receipt-documents");

let client!: ClientModule;
let invoices!: InvoiceModule;
let tmpDir = "";

function insertInvoiceRow(args: {
  id: string;
  sourcePath: string;
  category: string;
  issuer?: string | null;
  invoiceDate?: string | null;
  total?: number | null;
  currency?: string | null;
  vatPercent?: number | null;
  vatAmount?: number | null;
}): void {
  const now = "2026-01-01T00:00:00.000Z";
  const ai = JSON.stringify({
    image_analysis: {
      image_category: args.category,
      invoice_issuer: args.issuer ?? null,
      invoice_date: args.invoiceDate ?? null,
      invoice_total_amount: args.total ?? null,
      invoice_total_amount_currency: args.currency ?? null,
      vat_percent: args.vatPercent ?? null,
      vat_amount: args.vatAmount ?? null,
    },
  });
  client.getDesktopDatabase().prepare(
    `INSERT INTO media_items (
      id, library_id, source_path, filename, mime_type, ai_metadata,
      media_kind, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'image/jpeg', ?, 'image', ?, ?)`,
  ).run(
    args.id,
    LIBRARY_ID,
    args.sourcePath,
    path.basename(args.sourcePath),
    ai,
    now,
    now,
  );
}

function insertInvoiceRowDocumentData(args: {
  id: string;
  sourcePath: string;
  category: string;
  issuer?: string | null;
  invoiceDate?: string | null;
  total?: number | null;
  currency?: string | null;
  vatPercent?: number | null;
  vatAmount?: number | null;
}): void {
  const now = "2026-01-01T00:00:00.000Z";
  const ai = JSON.stringify({
    image_analysis: {
      image_category: args.category,
    },
    document_data: {
      invoice_issuer: args.issuer ?? null,
      invoice_date: args.invoiceDate ?? null,
      invoice_total_amount: args.total ?? null,
      invoice_total_amount_currency: args.currency ?? null,
      vat_percent: args.vatPercent ?? null,
      vat_amount: args.vatAmount ?? null,
    },
  });
  client.getDesktopDatabase().prepare(
    `INSERT INTO media_items (
      id, library_id, source_path, filename, mime_type, ai_metadata,
      media_kind, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'image/jpeg', ?, 'image', ?, ?)`,
  ).run(
    args.id,
    LIBRARY_ID,
    args.sourcePath,
    path.basename(args.sourcePath),
    ai,
    now,
    now,
  );
}

describe.skipIf(!HAS_SQLITE)("invoice-receipt-documents", () => {
  beforeAll(async () => {
    client = await import("./client");
    invoices = await import("./invoice-receipt-documents");
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-inv-"));
    client.initDesktopDatabase(tmpDir);
  });

  afterEach(() => {
    client.__closeDesktopDatabaseForTesting();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("counts only invoice_or_receipt category", () => {
    insertInvoiceRow({
      id: "a",
      sourcePath: "/x/a.jpg",
      category: "invoice_or_receipt",
      issuer: "Acme",
    });
    insertInvoiceRow({
      id: "b",
      sourcePath: "/x/b.jpg",
      category: "food",
    });
    expect(invoices.countInvoiceReceiptDocuments(LIBRARY_ID)).toBe(1);
  });

  it("filters by issuer and paginates", () => {
    insertInvoiceRow({
      id: "1",
      sourcePath: "/p/one.jpg",
      category: "invoice_or_receipt",
      issuer: "Alpha GmbH",
      invoiceDate: "2024-06-01",
      total: 100,
      currency: "EUR",
    });
    insertInvoiceRow({
      id: "2",
      sourcePath: "/p/two.jpg",
      category: "invoice_or_receipt",
      issuer: "Beta SA",
      invoiceDate: "2024-08-01",
      total: 50,
      currency: "CHF",
    });

    const first = invoices.listInvoiceReceiptDocuments({
      issuedBy: "alpha",
      page: 0,
      pageSize: 1,
    });
    expect(first.total).toBe(1);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]?.issuer).toBe("Alpha GmbH");

    const cur = invoices.listInvoiceReceiptDocuments({
      currency: "CHF",
      page: 0,
      pageSize: 10,
    });
    expect(cur.total).toBe(1);
    expect(cur.rows[0]?.id).toBe("2");
  });

  it("reads invoice fields from document_data when image_analysis omits them", () => {
    insertInvoiceRowDocumentData({
      id: "doc-1",
      sourcePath: "/p/invoice.jpg",
      category: "invoice_or_receipt",
      issuer: "DocData Oy",
      invoiceDate: "2025-03-15",
      total: 199.5,
      currency: "EUR",
      vatPercent: 24,
      vatAmount: 38.61,
    });
    const list = invoices.listInvoiceReceiptDocuments({ page: 0, pageSize: 10 });
    expect(list.rows).toHaveLength(1);
    const row = list.rows[0];
    expect(row?.issuer).toBe("DocData Oy");
    expect(row?.invoiceDate).toBe("2025-03-15");
    expect(row?.totalAmount).toBe(199.5);
    expect(row?.currency).toBe("EUR");
    expect(row?.vatPercent).toBe(24);
    expect(row?.vatAmount).toBe(38.61);
  });

  it("filters by partial date-from year (YYYY)", () => {
    insertInvoiceRow({
      id: "y24",
      sourcePath: "/x/y24.jpg",
      category: "invoice_or_receipt",
      invoiceDate: "2024-06-01",
    });
    insertInvoiceRow({
      id: "y25",
      sourcePath: "/x/y25.jpg",
      category: "invoice_or_receipt",
      invoiceDate: "2025-01-15",
    });
    const list = invoices.listInvoiceReceiptDocuments({
      dateFrom: "2025",
      page: 0,
      pageSize: 10,
    });
    expect(list.total).toBe(1);
    expect(list.rows[0]?.id).toBe("y25");
  });
});
