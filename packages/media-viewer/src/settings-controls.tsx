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
}

const SETTINGS_SECTION_CARD_CLASS =
  "group rounded-lg border border-border/70 bg-card/40 p-0 shadow-sm [&_summary::-webkit-details-marker]:hidden";
const SETTINGS_SECTION_HEADER_CLASS =
  "flex cursor-pointer list-none items-center gap-2 rounded-t-lg border-b border-border/60 bg-muted/35 px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted/55 group-open:bg-muted/55";
const SETTINGS_SECTION_BODY_CLASS = "mt-3 px-4 pb-4";
const SETTINGS_FIELD_SURFACE_CLASS = "rounded-md border border-border/70 bg-background/40 p-3";

export function SettingsSectionCard({
  title,
  children,
  defaultOpen = false,
  className,
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
        SETTINGS_FIELD_SURFACE_CLASS,
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="m-0 text-base font-medium text-foreground">{title}</h4>
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
}

export function SettingsCheckboxField({
  title,
  description,
  checked,
  onChange,
  checkboxClassName,
  disabled = false,
}: SettingsCheckboxFieldProps): ReactElement {
  const [showDescription, setShowDescription] = useState(false);
  const fieldId = useId();

  return (
    <div className={SETTINGS_FIELD_SURFACE_CLASS}>
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
