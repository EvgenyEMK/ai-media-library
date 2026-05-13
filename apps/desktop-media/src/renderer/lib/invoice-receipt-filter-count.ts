import type { InvoiceReceiptDocumentsListRequest } from "../../shared/ipc";

export function countActiveInvoiceFilters(filters: InvoiceReceiptDocumentsListRequest): number {
  let n = 0;
  if (filters.issuedBy?.trim()) n += 1;
  if (filters.dateFrom?.trim()) n += 1;
  if (filters.dateTo?.trim()) n += 1;
  if (filters.totalFrom != null && Number.isFinite(filters.totalFrom)) n += 1;
  if (filters.totalTo != null && Number.isFinite(filters.totalTo)) n += 1;
  if (filters.currency?.trim()) n += 1;
  return n;
}
