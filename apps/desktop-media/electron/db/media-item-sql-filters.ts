/**
 * Shared SQL predicate fragments for `media_items` filtering (vector, FTS, etc.).
 */

export interface EventAndLocationFilterInput {
  eventDateStart?: string;
  eventDateEnd?: string;
  locationQuery?: string;
}

export function appendEventAndLocationPredicates(
  where: string[],
  args: unknown[],
  tableAlias: string,
  filters: EventAndLocationFilterInput,
): void {
  const t = tableAlias;
  const start = filters.eventDateStart?.trim();
  const end = filters.eventDateEnd?.trim();
  if (start) {
    where.push(
      `${t}.event_date_start IS NOT NULL AND COALESCE(${t}.event_date_end, ${t}.event_date_start) >= ?`,
    );
    args.push(start);
  }
  if (end) {
    where.push(`${t}.event_date_start IS NOT NULL AND ${t}.event_date_start <= ?`);
    args.push(end);
  }
  if (filters.locationQuery?.trim()) {
    const q = `%${filters.locationQuery.trim()}%`;
    where.push(
      `(${t}.country LIKE ? OR ${t}.city LIKE ? OR ${t}.location_area LIKE ? OR ${t}.location_area2 LIKE ? OR ${t}.location_place LIKE ? OR ${t}.location_name LIKE ?)`,
    );
    args.push(q, q, q, q, q, q);
  }
}
