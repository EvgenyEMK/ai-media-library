/**
 * Convert an underscore-separated string to a headline-case label.
 * e.g. "white_balance_fix" → "White Balance Fix"
 */
export function toHeadlineLabel(value: string): string {
  return value
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Map a person category key to a display label.
 */
export function getCategoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const map: Record<string, string> = { adult: "Adult", child: "Child", baby: "Baby" };
  return map[category.toLowerCase()] ?? category;
}

/**
 * Map a gender key to a display label.
 */
export function getGenderLabel(gender?: string | null): string | null {
  if (!gender) return null;
  const map: Record<string, string> = { male: "Male", female: "Female", unknown: "Unknown", other: "Other" };
  return map[gender.toLowerCase()] ?? gender;
}
