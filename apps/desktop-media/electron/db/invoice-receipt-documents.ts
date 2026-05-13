import type {
  InvoiceReceiptDocumentsListRequest,
  InvoiceReceiptDocumentsListResult,
  InvoiceReceiptDocumentRow,
} from "../../src/shared/ipc";
import { inferCatalogMediaKind } from "../../src/shared/ipc";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { getDesktopDatabase } from "./client";
import {
  normalizeInvoiceDateFromForQuery,
  normalizeInvoiceDateToForQuery,
} from "../../src/renderer/lib/invoice-receipt-date-query";

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 48;

function invoiceCategoryLowerExpr(): string {
  return `LOWER(TRIM(COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.image_category') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.image_category') AS TEXT),
    ''
  )))`;
}

/** Invoice fields are stored under `document_data` after LLM extraction; older rows may use `image_analysis` or top-level keys. */
function issuerExpr(): string {
  return `COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.invoice_issuer') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.document_data.invoice_issuer') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.invoice_issuer') AS TEXT)
  )`;
}

function invoiceDateExpr(): string {
  return `COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.invoice_date') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.document_data.invoice_date') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.invoice_date') AS TEXT)
  )`;
}

function totalAmountExpr(): string {
  return `COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.invoice_total_amount') AS REAL),
    CAST(json_extract(mi.ai_metadata, '$.document_data.invoice_total_amount') AS REAL),
    CAST(json_extract(mi.ai_metadata, '$.invoice_total_amount') AS REAL)
  )`;
}

function currencyExpr(): string {
  return `COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.invoice_total_amount_currency') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.document_data.invoice_total_amount_currency') AS TEXT),
    CAST(json_extract(mi.ai_metadata, '$.invoice_total_amount_currency') AS TEXT)
  )`;
}

function vatPercentExpr(): string {
  return `COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.vat_percent') AS REAL),
    CAST(json_extract(mi.ai_metadata, '$.document_data.vat_percent') AS REAL),
    CAST(json_extract(mi.ai_metadata, '$.vat_percent') AS REAL)
  )`;
}

function vatAmountExpr(): string {
  return `COALESCE(
    CAST(json_extract(mi.ai_metadata, '$.image_analysis.vat_amount') AS REAL),
    CAST(json_extract(mi.ai_metadata, '$.document_data.vat_amount') AS REAL),
    CAST(json_extract(mi.ai_metadata, '$.vat_amount') AS REAL)
  )`;
}

function clampPageSize(raw: number | undefined): number {
  if (!Number.isFinite(raw) || raw == null) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.max(1, Math.trunc(raw)), MAX_PAGE_SIZE);
}

function clampPage(raw: number | undefined): number {
  if (!Number.isFinite(raw) || raw == null) {
    return 0;
  }
  return Math.max(0, Math.trunc(raw));
}

function appendInvoiceReceiptFilters(
  where: string[],
  args: unknown[],
  filters: InvoiceReceiptDocumentsListRequest,
): void {
  const issuedBy = filters.issuedBy?.trim();
  if (issuedBy) {
    where.push(`LOWER(IFNULL(${issuerExpr()}, '')) LIKE ?`);
    args.push(`%${issuedBy.toLowerCase()}%`);
  }

  const dateFromNorm = filters.dateFrom?.trim()
    ? normalizeInvoiceDateFromForQuery(filters.dateFrom.trim())
    : null;
  if (dateFromNorm) {
    where.push(`IFNULL(${invoiceDateExpr()}, '') >= ?`);
    args.push(dateFromNorm);
  }

  const dateToNorm = filters.dateTo?.trim()
    ? normalizeInvoiceDateToForQuery(filters.dateTo.trim())
    : null;
  if (dateToNorm) {
    where.push(`IFNULL(${invoiceDateExpr()}, '') <= ?`);
    args.push(dateToNorm);
  }

  if (filters.totalFrom != null && Number.isFinite(filters.totalFrom)) {
    where.push(`${totalAmountExpr()} IS NOT NULL AND ${totalAmountExpr()} >= ?`);
    args.push(filters.totalFrom);
  }
  if (filters.totalTo != null && Number.isFinite(filters.totalTo)) {
    where.push(`${totalAmountExpr()} IS NOT NULL AND ${totalAmountExpr()} <= ?`);
    args.push(filters.totalTo);
  }

  const currency = filters.currency?.trim().toUpperCase();
  if (currency && currency.length === 3) {
    where.push(`UPPER(TRIM(IFNULL(${currencyExpr()}, ''))) = ?`);
    args.push(currency);
  }
}

const baseWhere = (libraryId: string): { sql: string; args: unknown[] } => {
  const cat = invoiceCategoryLowerExpr();
  const args: unknown[] = [libraryId];
  const where = [
    "mi.library_id = ?",
    "mi.deleted_at IS NULL",
    `(${cat}) = 'invoice_or_receipt'`,
  ];
  return { sql: where.join(" AND "), args };
};

export function countInvoiceReceiptDocuments(libraryId = DEFAULT_LIBRARY_ID): number {
  const db = getDesktopDatabase();
  const { sql, args } = baseWhere(libraryId);
  const row = db.prepare(`SELECT COUNT(1) AS c FROM media_items mi WHERE ${sql}`).get(...args) as {
    c: number;
  };
  return Number(row?.c ?? 0);
}

export function listInvoiceReceiptDocuments(
  request: InvoiceReceiptDocumentsListRequest,
): InvoiceReceiptDocumentsListResult {
  const libraryId = request.libraryId?.trim() || DEFAULT_LIBRARY_ID;
  const pageSize = clampPageSize(request.pageSize);
  const page = clampPage(request.page);
  const offset = page * pageSize;

  const { sql: baseSql, args: baseArgs } = baseWhere(libraryId);
  const where = [baseSql];
  const args: unknown[] = [...baseArgs];

  appendInvoiceReceiptFilters(where, args, request);

  const whereClause = where.join(" AND ");

  const db = getDesktopDatabase();
  const totalRow = db
    .prepare(`SELECT COUNT(1) AS c FROM media_items mi WHERE ${whereClause}`)
    .get(...args) as { c: number };
  const total = Number(totalRow?.c ?? 0);

  const dateExpr = invoiceDateExpr();
  const rows = db
    .prepare(
      `SELECT
         mi.id,
         mi.source_path,
         mi.filename,
         mi.mime_type,
         ${issuerExpr()} AS issuer,
         ${invoiceDateExpr()} AS invoice_date,
         ${totalAmountExpr()} AS total_amount,
         ${currencyExpr()} AS currency,
         ${vatPercentExpr()} AS vat_percent,
         ${vatAmountExpr()} AS vat_amount
       FROM media_items mi
       WHERE ${whereClause}
       ORDER BY
         CASE WHEN IFNULL(${dateExpr}, '') = '' THEN 1 ELSE 0 END,
         ${dateExpr} DESC,
         mi.source_path ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, offset) as Array<{
    id: string;
    source_path: string;
    filename: string;
    mime_type: string | null;
    issuer: string | null;
    invoice_date: string | null;
    total_amount: number | null;
    currency: string | null;
    vat_percent: number | null;
    vat_amount: number | null;
  }>;

  const mapped: InvoiceReceiptDocumentRow[] = rows.map((r) => ({
    id: r.id,
    sourcePath: r.source_path,
    filename: r.filename,
    mediaKind: inferCatalogMediaKind(r.source_path, r.mime_type),
    issuer: r.issuer,
    invoiceDate: r.invoice_date,
    totalAmount: r.total_amount,
    currency: r.currency,
    vatPercent: r.vat_percent,
    vatAmount: r.vat_amount,
  }));

  return { total, rows: mapped };
}
