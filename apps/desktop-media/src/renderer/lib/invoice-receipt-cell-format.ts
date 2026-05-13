/** Display helpers for the invoices & receipts table (renderer-only). */

export function formatInvoiceTotalCell(amount: number | null, currency: string | null): string {
  if (amount == null || !Number.isFinite(amount)) {
    return "—";
  }
  const cur = currency?.trim() ?? "";
  return cur.length > 0 ? `${amount} ${cur}` : String(amount);
}

export function formatInvoiceVatCell(
  vatPercent: number | null,
  vatAmount: number | null,
  currency: string | null,
): string {
  const pctPart =
    vatPercent != null && Number.isFinite(vatPercent) ? `${vatPercent}%` : "—";
  if (vatAmount == null || !Number.isFinite(vatAmount)) {
    return pctPart;
  }
  const cur = currency?.trim() ?? "";
  const amtPart = cur.length > 0 ? ` (${vatAmount} ${cur})` : ` (${vatAmount})`;
  return `${pctPart}${amtPart}`;
}
