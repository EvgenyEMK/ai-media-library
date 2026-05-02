/**
 * Pure helpers for resolving a person's age from birth date vs media event date,
 * with fallback to face-pipeline estimated age (years).
 */

export type ResolvedPersonAge = {
  years: number;
  source: "birth_date" | "estimated_age_years";
};

function parseCalendarParts(iso: string): { y: number; m: number; d: number } | null {
  const trimmed = iso.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) {
    return null;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function compareCalendar(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/**
 * Whole years between birth date and reference date (both interpreted as UTC calendar dates).
 * Returns null if inputs are invalid or reference is strictly before birth.
 */
export function computeAgeYearsAt(
  birthDateIso: string | null | undefined,
  referenceIso: string | null | undefined,
): number | null {
  const birth = birthDateIso ? parseCalendarParts(birthDateIso) : null;
  const ref = referenceIso ? parseCalendarParts(referenceIso) : null;
  if (!birth || !ref) {
    return null;
  }
  if (compareCalendar(ref, birth) < 0) {
    return null;
  }
  let age = ref.y - birth.y;
  if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) {
    age -= 1;
  }
  return age;
}

/**
 * Prefers age from birth date + media event date; falls back to ONNX estimated age on the face row.
 */
export function resolvePersonAgeYearsForMedia(input: {
  birthDate: string | null;
  mediaEventDate: string | null;
  estimatedAgeYears: number | null;
}): ResolvedPersonAge | null {
  const fromBirth = computeAgeYearsAt(input.birthDate, input.mediaEventDate);
  if (fromBirth !== null) {
    return { years: fromBirth, source: "birth_date" };
  }
  const est = input.estimatedAgeYears;
  if (est !== null && est !== undefined && Number.isFinite(est)) {
    return { years: Math.round(est), source: "estimated_age_years" };
  }
  return null;
}
