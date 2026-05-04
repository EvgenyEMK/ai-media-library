/** Display placeholder for album date range fields (full rules in hint text). */
export const ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER = "YYYY-MM";

/** Shown when either From or To is focused. */
export const ALBUM_YEAR_MONTH_INPUT_HINT = "YYYY or YYYY-MM";

const MAX_DIGITS = 6;

/**
 * Builds a `YYYY` or `YYYY-MM` string from digits only (hyphens inserted after the year).
 * Rejects invalid partial months while typing.
 */
export function sanitizeAlbumYearMonthDigitsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, MAX_DIGITS);
  const year = digits.slice(0, 4);
  let monthDigits = digits.slice(4);

  if (monthDigits.length >= 1) {
    const first = monthDigits[0];
    if (first !== undefined && first > "1") {
      monthDigits = "";
    }
  }

  if (monthDigits.length === 2) {
    const monthNum = Number(`${monthDigits[0]}${monthDigits[1]}`);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      monthDigits = monthDigits.slice(0, 1) ?? "";
    }
  }

  if (monthDigits.length === 0) {
    return year;
  }
  return `${year}-${monthDigits}`;
}
