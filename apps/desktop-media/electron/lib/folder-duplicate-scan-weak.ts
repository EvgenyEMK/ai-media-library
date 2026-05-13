import path from "node:path";

/** Minimal row shape for weak duplicate grouping (file name + size + mtime). */
export interface WeakDuplicateMatchRow {
  source_path: string;
  byte_size: number | null;
  file_mtime_ms: number | null;
}

/**
 * Fingerprint for weak duplicate detection: basename (case-insensitive), byte size, and file mtime (ms).
 * Returns null when size or mtime is missing (weak matching is not applied for that row).
 */
export function weakDuplicateFingerprint(row: WeakDuplicateMatchRow): string | null {
  if (row.byte_size == null || row.file_mtime_ms == null) {
    return null;
  }
  const base = path.basename(row.source_path).toLowerCase();
  return `${base}\0${String(row.byte_size)}\0${String(row.file_mtime_ms)}`;
}

/** Group rows that share the same weak fingerprint. */
export function bucketWeakDuplicateRows<T extends WeakDuplicateMatchRow>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const fp = weakDuplicateFingerprint(row);
    if (!fp) {
      continue;
    }
    const list = map.get(fp) ?? [];
    list.push(row);
    map.set(fp, list);
  }
  return map;
}
