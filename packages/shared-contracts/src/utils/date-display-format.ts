export type DateDisplayFormat = "YYYY-MM-DD" | "DD.MM.YYYY" | "MM/DD/YYYY";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateByPreference(
  inputDate: Date | string,
  formatPreference: DateDisplayFormat,
): string {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  if (formatPreference === "YYYY-MM-DD") {
    return `${year}-${month}-${day}`;
  }
  if (formatPreference === "MM/DD/YYYY") {
    return `${month}/${day}/${year}`;
  }
  return `${day}.${month}.${year}`;
}

export function detectDefaultDateFormatFromLocale(locale: string | null | undefined): DateDisplayFormat {
  if (!locale || locale.trim().length === 0) {
    return "DD.MM.YYYY";
  }
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(Date.UTC(2001, 1, 3)));
    const order = parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => part.type)
      .join("-");
    if (order === "year-month-day") {
      return "YYYY-MM-DD";
    }
    if (order === "month-day-year") {
      return "MM/DD/YYYY";
    }
    if (order === "day-month-year") {
      return "DD.MM.YYYY";
    }
  } catch {
    // Ignore and use fallback.
  }
  return "DD.MM.YYYY";
}
