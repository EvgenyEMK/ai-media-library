/** Pure helpers for invoice table amount/VAT display and sanity checks. */

const DECIMAL_WARNING_MIN_FRACTION_DIGITS = 3;
const TOTAL_DISPLAY_MAX_FRACTION_IF_WARNING = 4;
const VAT_AMOUNT_TOLERANCE_BASE = 0.02;
const VAT_AMOUNT_TOLERANCE_REL = 1e-4;
const VAT_PERCENT_TOLERANCE = 0.35;
/** Max relative error between metadata VAT and exclusive/inclusive model amounts (10%). */
const VAT_CALC_VS_METADATA_MAX_REL_ERROR = 0.1;

function amountTolerance(total: number): number {
  return Math.max(VAT_AMOUNT_TOLERANCE_BASE, Math.abs(total) * VAT_AMOUNT_TOLERANCE_REL);
}

/** True when `a` and `b` differ by at most 10% of max(|a|,|b|). */
export function vatAmountsWithinTenPercentRelative(a: number, b: number): boolean {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / denom <= VAT_CALC_VS_METADATA_MAX_REL_ERROR;
}

function vatMetadataAmountWithinTenPercentOfModels(
  total: number,
  vatPercent: number,
  vatAmount: number,
): boolean {
  const exclusive = total * (vatPercent / 100);
  const inclusive = total * (vatPercent / (100 + vatPercent));
  return (
    vatAmountsWithinTenPercentRelative(exclusive, vatAmount) ||
    vatAmountsWithinTenPercentRelative(inclusive, vatAmount)
  );
}

/** Counts fractional digits in a plain decimal string (no scientific notation). */
export function countFractionalDigits(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const str = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumFractionDigits: 20,
  }).format(amount);
  const dot = str.indexOf(".");
  if (dot < 0) {
    return 0;
  }
  return str.slice(dot + 1).replace(/0+$/, "").length;
}

export function totalAmountNeedsDecimalWarning(amount: number): boolean {
  return countFractionalDigits(amount) >= DECIMAL_WARNING_MIN_FRACTION_DIGITS;
}

export function vatAmountNeedsDecimalWarning(amount: number): boolean {
  return countFractionalDigits(amount) >= DECIMAL_WARNING_MIN_FRACTION_DIGITS;
}

export function formatGroupedAmount(amount: number, maxFractionDigits: number): string {
  return new Intl.NumberFormat(undefined, {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(amount);
}

export function formatInvoiceTotalDisplayParts(
  amount: number | null,
  currency: string | null,
): {
  display: string;
  decimalPlacesWarning: boolean;
} {
  if (amount == null || !Number.isFinite(amount)) {
    return { display: "—", decimalPlacesWarning: false };
  }
  const decimalPlacesWarning = totalAmountNeedsDecimalWarning(amount);
  const maxFrac = decimalPlacesWarning ? TOTAL_DISPLAY_MAX_FRACTION_IF_WARNING : 8;
  const num = formatGroupedAmount(amount, maxFrac);
  const cur = currency?.trim() ?? "";
  return {
    display: cur.length > 0 ? `${num} ${cur}` : num,
    decimalPlacesWarning,
  };
}

/**
 * Returns true when stored VAT % and amounts disagree beyond typical rounding,
 * using inclusive-VAT, exclusive-VAT, and implied-rate-from-net checks.
 */
export function isInvoiceVatPercentMismatch(
  total: number | null,
  vatPercent: number | null,
  vatAmount: number | null,
): boolean {
  if (vatPercent == null || !Number.isFinite(vatPercent)) {
    return false;
  }
  if (total == null || !Number.isFinite(total) || total === 0) {
    return false;
  }
  if (vatAmount == null || !Number.isFinite(vatAmount)) {
    return false;
  }

  const tol = amountTolerance(total);

  const inclusive = total * (vatPercent / (100 + vatPercent));
  if (Math.abs(inclusive - vatAmount) <= tol) {
    return false;
  }

  const exclusive = total * (vatPercent / 100);
  if (Math.abs(exclusive - vatAmount) <= tol) {
    return false;
  }

  const net = total - vatAmount;
  if (net > tol) {
    const implied = (100 * vatAmount) / net;
    if (Math.abs(implied - vatPercent) <= VAT_PERCENT_TOLERANCE) {
      return false;
    }
  }

  if (vatMetadataAmountWithinTenPercentOfModels(total, vatPercent, vatAmount)) {
    return false;
  }

  return true;
}

export function formatInvoiceVatDisplayParts(
  total: number | null,
  vatPercent: number | null,
  vatAmount: number | null,
  currency: string | null,
): {
  line: string;
  percentMismatch: boolean;
  decimalWarningOnAmount: boolean;
} {
  const pctPart =
    vatPercent != null && Number.isFinite(vatPercent) ? `${formatGroupedAmount(vatPercent, 4)}%` : "—";

  let amtPart = "";
  let vatAmountHasLongFraction = false;
  if (vatAmount != null && Number.isFinite(vatAmount)) {
    vatAmountHasLongFraction = vatAmountNeedsDecimalWarning(vatAmount);
    const maxFrac = vatAmountHasLongFraction ? 4 : 8;
    const n = formatGroupedAmount(vatAmount, maxFrac);
    const cur = currency?.trim() ?? "";
    amtPart = cur.length > 0 ? ` (${n} ${cur})` : ` (${n})`;
  }

  const line = amtPart.length > 0 ? `${pctPart}${amtPart}` : pctPart;
  const percentMismatch = isInvoiceVatPercentMismatch(total, vatPercent, vatAmount);
  const decimalWarningOnAmount = vatAmountHasLongFraction && !percentMismatch;

  return { line, percentMismatch, decimalWarningOnAmount };
}
