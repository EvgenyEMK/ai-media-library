const BYTES_PER_GB = 1024 ** 3;
const BYTES_PER_MB = 1024 ** 2;

/**
 * Duplicate workspace metric cards: GB with one decimal when size ≥ 1 GB, otherwise MB.
 */
export function formatStorageSizeForDuplicateMetricCards(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }
  if (bytes >= BYTES_PER_GB) {
    return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
  }
  const mb = bytes / BYTES_PER_MB;
  if (mb >= 100) {
    return `${mb.toFixed(0)} MB`;
  }
  if (mb >= 10) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${mb.toFixed(2)} MB`;
}

/**
 * Duplicate delete confirmation: MB (fractional) or GB (one decimal) when ≥ 1 GB.
 */
export function formatMbOrGbForDeleteConfirm(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }
  if (bytes >= BYTES_PER_GB) {
    return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
  }
  const mb = bytes / BYTES_PER_MB;
  if (mb >= 100) {
    return `${mb.toFixed(0)} MB`;
  }
  if (mb >= 10) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${mb.toFixed(2)} MB`;
}

export function formatDuplicateShareInScanScopePercent(
  scopedNumerator: number,
  selectionScopeMediaCount: number | null,
): { primaryText: string; loading: boolean } {
  if (selectionScopeMediaCount === null) {
    return { primaryText: "", loading: true };
  }
  if (selectionScopeMediaCount <= 0) {
    return { primaryText: "0.0%", loading: false };
  }
  const pct = (Math.round((1000 * scopedNumerator) / selectionScopeMediaCount) / 10).toFixed(1);
  return { primaryText: `${pct}%`, loading: false };
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB_TABLE = BYTES_PER_KB * 1024;
const BYTES_PER_GB_TABLE = BYTES_PER_MB_TABLE * 1024;

function trimFractionalZeros(value: string): string {
  if (!value.includes(".")) {
    return value;
  }
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/**
 * Folder duplicate table cells: human-readable size with Kb / Mb / Gb suffix (e.g. `250 Mb`, `1.34 Gb`).
 */
export function formatFolderTableDuplicateSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 Kb";
  }
  if (bytes >= BYTES_PER_GB_TABLE) {
    const g = bytes / BYTES_PER_GB_TABLE;
    const s = g >= 10 ? g.toFixed(1) : g.toFixed(2);
    return `${trimFractionalZeros(s)} Gb`;
  }
  if (bytes >= BYTES_PER_MB_TABLE) {
    const m = bytes / BYTES_PER_MB_TABLE;
    const s = m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2);
    return `${trimFractionalZeros(s)} Mb`;
  }
  const k = bytes / BYTES_PER_KB;
  const s = k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2);
  return `${trimFractionalZeros(s)} Kb`;
}
