/**
 * Progress-counter formatting shared across the desktop-media background operations UI.
 *
 * Rules:
 * - Use apostrophe as thousand separator: 2000 => 2'000
 * - Use " / " with spaces for ratio counters: 2000 / 35040
 */

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";

  const truncated = Math.trunc(value);
  const sign = truncated < 0 ? "-" : "";
  const absStr = Math.abs(truncated).toString();
  return `${sign}${absStr.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;
}

export function formatCountRatio(numerator: number, denominator: number): string {
  return `${formatCount(numerator)} / ${formatCount(denominator)}`;
}

