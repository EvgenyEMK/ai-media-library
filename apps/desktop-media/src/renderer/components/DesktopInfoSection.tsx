import { type ReactElement } from "react";
const UNKNOWN_TEXT_VALUES = new Set(["unknown", "n/a", "na", "null", "undefined"]);

export type DesktopInfoFieldDisplayMode = "inline" | "stacked";

export interface DesktopInfoField {
  label: string;
  value: string | number | null | undefined;
  display?: DesktopInfoFieldDisplayMode;
}

interface DesktopInfoSectionProps {
  title: string;
  fields: DesktopInfoField[];
  defaultOpen?: boolean;
  emptyStateMessage?: string;
}

function shouldRenderValue(value: string | number | null | undefined): value is string | number {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || UNKNOWN_TEXT_VALUES.has(normalized)) {
    return false;
  }
  return true;
}

export function DesktopInfoSection({
  title,
  fields,
  defaultOpen = false,
  emptyStateMessage = "No data available.",
}: DesktopInfoSectionProps): ReactElement {
  const visibleFields = fields.filter((field) => shouldRenderValue(field.value));
  const detailsInitialStateProps = defaultOpen ? { open: true } : {};
  return (
    <details
      className="overflow-hidden rounded-[10px] border border-border bg-card [&[open]>summary>.desktop-info-section-chevron]:rotate-90"
      {...detailsInitialStateProps}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span
          className="desktop-info-section-chevron inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-transform duration-200"
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="desktop-info-section-title min-w-0 flex-1 text-[13px] font-semibold text-foreground">
          {title}
        </span>
        <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-border bg-background px-1.5 text-[11px] text-muted-foreground">
          {visibleFields.length}
        </span>
      </summary>
      <div className="px-3 py-2.5">
        {visibleFields.length > 0 ? (
          <dl className="grid gap-2.5">
            {visibleFields.map((field) =>
              field.display === "stacked" ? (
                <div key={field.label} className="desktop-info-field m-0">
                  <dt className="m-0 text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-foreground">{field.value}</dd>
                </div>
              ) : (
                <div key={field.label} className="desktop-info-field m-0 flex flex-wrap items-baseline gap-1.5">
                  <dt className="m-0 text-xs text-muted-foreground">{field.label}:</dt>
                  <dd className="m-0 break-words text-[13px] text-foreground">{field.value}</dd>
                </div>
              ),
            )}
          </dl>
        ) : (
          <p className="m-0 text-[13px] text-muted-foreground">{emptyStateMessage}</p>
        )}
      </div>
    </details>
  );
}
