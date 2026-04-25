"use client";

import { useEffect, useId, useState, type ReactElement, type ReactNode } from "react";

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

interface SettingsSectionCardProps {
  title: string;
  children?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  advanced?: boolean;
}

const SETTINGS_SECTION_CARD_CLASS =
  "group rounded-lg border border-border/70 bg-card/40 p-0 shadow-sm [&_summary::-webkit-details-marker]:hidden";
const SETTINGS_SECTION_HEADER_CLASS =
  "flex cursor-pointer list-none items-center gap-2 rounded-t-lg border-b border-border/60 bg-muted/35 px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted/55 group-open:bg-muted/55";
const SETTINGS_SECTION_BODY_CLASS = "mt-3 px-4 pb-4";
const SETTINGS_FIELD_SURFACE_CLASS = "rounded-md border border-border/70 bg-background/40 p-3";

export type SettingsOptionSurfaceVariant = "default" | "soft-selected" | "accent-stripe" | "muted";

function settingsOptionSurfaceClass(
  variant: SettingsOptionSurfaceVariant,
  selected = false,
): string {
  if (variant === "soft-selected") {
    return "rounded-md border border-primary/45 bg-primary/10 p-3";
  }
  if (variant === "accent-stripe") {
    return joinClasses(
      "rounded-md border border-border/70 border-l-4 bg-background/40 p-3",
      selected ? "border-l-primary/70" : "border-l-border",
    );
  }
  if (variant === "muted") {
    return "rounded-md border border-border/70 bg-muted/20 p-3";
  }
  return SETTINGS_FIELD_SURFACE_CLASS;
}

function AdvancedSettingsStar(): ReactElement {
  return (
    <svg
      aria-label="Advanced setting"
      role="img"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 1.7L9.75 5.5L13.9 6L10.82 8.83L11.64 12.95L8 10.9L4.36 12.95L5.18 8.83L2.1 6L6.25 5.5L8 1.7Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsSectionCard({
  title,
  children,
  defaultOpen = false,
  className,
  advanced = false,
}: SettingsSectionCardProps): ReactElement {
  return (
    <details
      className={joinClasses(SETTINGS_SECTION_CARD_CLASS, className)}
      open={defaultOpen}
    >
      <summary className={SETTINGS_SECTION_HEADER_CLASS}>
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground transition-transform group-open:rotate-90"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>{title}</span>
        {advanced ? <AdvancedSettingsStar /> : null}
      </summary>
      <div className={SETTINGS_SECTION_BODY_CLASS}>{children}</div>
    </details>
  );
}

interface SettingsNumberFieldProps {
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (nextValue: number) => void;
  disabled?: boolean;
  advanced?: boolean;
  surfaceVariant?: SettingsOptionSurfaceVariant;
}

export function SettingsNumberField({
  title,
  description,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  disabled = false,
  advanced = false,
  surfaceVariant = "accent-stripe",
}: SettingsNumberFieldProps): ReactElement {
  const [inputValue, setInputValue] = useState(() => String(value));
  const [showDescription, setShowDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const commit = (): void => {
    if (disabled) {
      setInputValue(String(value));
      return;
    }
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setError(`Value must be between ${min} and ${max}.`);
      return;
    }
    setError(null);
    onChange(parsed);
  };

  return (
    <div
      className={joinClasses(
        settingsOptionSurfaceClass(surfaceVariant, !disabled),
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="m-0 text-base font-medium text-foreground">{title}</h4>
            {advanced ? <AdvancedSettingsStar /> : null}
            <button
              type="button"
              aria-label={`Toggle description for ${title}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground"
              onClick={() => setShowDescription((current) => !current)}
            >
              ?
            </button>
          </div>
          {showDescription ? (
            <div className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {description.trim()}
            </div>
          ) : null}
        </div>
        <input
          type="number"
          value={inputValue}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="h-9 w-32 rounded-md border border-border bg-background px-2 text-base disabled:cursor-not-allowed"
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Allowed range: {min} - {max}
      </p>
    </div>
  );
}

interface SettingsCheckboxFieldProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  checkboxClassName: string;
  /** When set, the control is non-interactive (e.g. informational fixed policy). */
  disabled?: boolean;
  advanced?: boolean;
  surfaceVariant?: SettingsOptionSurfaceVariant;
}

export function SettingsCheckboxField({
  title,
  description,
  checked,
  onChange,
  checkboxClassName,
  disabled = false,
  advanced = false,
  surfaceVariant = "accent-stripe",
}: SettingsCheckboxFieldProps): ReactElement {
  const [showDescription, setShowDescription] = useState(false);
  const fieldId = useId();

  return (
    <div className={settingsOptionSurfaceClass(surfaceVariant, checked)}>
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          className={checkboxClassName}
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            if (!disabled) {
              onChange(event.target.checked);
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor={fieldId}
              className={`m-0 text-base font-medium text-foreground ${disabled ? "cursor-default opacity-80" : "cursor-pointer"}`}
            >
              {title}
            </label>
            {advanced ? <AdvancedSettingsStar /> : null}
            <button
              type="button"
              aria-label={`Toggle description for ${title}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground"
              onClick={() => setShowDescription((current) => !current)}
            >
              ?
            </button>
          </div>
          {showDescription ? (
            <div className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {description.trim()}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
