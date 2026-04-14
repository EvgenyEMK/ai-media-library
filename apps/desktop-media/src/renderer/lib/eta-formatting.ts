export const ETA_RECENT_WINDOW_SIZE = 5;
export const ETA_MIN_RECENT_SAMPLES = 3;

export function formatTimeLeftCompact(totalSeconds: number): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }
  const roundedMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

  const dayThresholdMinutes = 24 * 60;
  if (roundedMinutes > dayThresholdMinutes) {
    const days = Math.floor(roundedMinutes / (24 * 60));
    const remainderAfterDays = roundedMinutes % (24 * 60);
    const hours = Math.floor(remainderAfterDays / 60);
    const minutes = remainderAfterDays % 60;
    return `${days}d ${hours}h ${minutes}min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (hours <= 0) return `${minutes}min`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h${minutes}min`;
}

export function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
