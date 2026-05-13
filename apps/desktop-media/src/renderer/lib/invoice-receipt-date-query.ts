/**
 * Normalizes invoice date filter strings to inclusive YYYY-MM-DD bounds for SQL
 * (`invoice_date` is compared as ISO date text).
 */

export function normalizeInvoiceDateFromForQuery(trimmed: string): string | null {
  const s = trimmed.trim();
  if (!s) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    return `${s}-01`;
  }
  if (/^\d{4}$/.test(s)) {
    return `${s}-01-01`;
  }
  return null;
}

export function normalizeInvoiceDateToForQuery(trimmed: string): string | null {
  const s = trimmed.trim();
  if (!s) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [ys, ms] = s.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return null;
    }
    const d = new Date(Date.UTC(y, m, 0));
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${ys}-${ms}-${day}`;
  }
  if (/^\d{4}$/.test(s)) {
    return `${s}-12-31`;
  }
  return null;
}
