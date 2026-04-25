export interface AlbumDateBounds {
  start?: string;
  end?: string;
}

const YEAR_RE = /^\d{4}$/;
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseAlbumYearMonthBound(
  value: string | undefined,
  mode: "start" | "end",
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (YEAR_RE.test(trimmed)) {
    return mode === "start" ? `${trimmed}-01-01` : `${trimmed}-12-31T23:59:59.999Z`;
  }

  const match = YEAR_MONTH_RE.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return undefined;
  }

  if (mode === "start") {
    return `${match[1]}-${match[2]}-01`;
  }

  return `${match[1]}-${match[2]}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}T23:59:59.999Z`;
}

export function normalizeAlbumDateBounds(filters: {
  yearMonthFrom?: string;
  yearMonthTo?: string;
}): AlbumDateBounds {
  return {
    start: parseAlbumYearMonthBound(filters.yearMonthFrom, "start"),
    end: parseAlbumYearMonthBound(filters.yearMonthTo, "end"),
  };
}
