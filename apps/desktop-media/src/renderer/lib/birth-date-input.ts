const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Restricts input to an in-progress ISO date-only string (YYYY-MM-DD).
 * Strips non-digits, inserts hyphens after year and month, max length 10.
 */
export function formatIsoDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** True when `value` is a real calendar day in UTC (no time component). */
export function isValidIsoDateString(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return false;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
