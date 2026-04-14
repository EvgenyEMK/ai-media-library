"use client";

import { type ReactElement } from "react";

const UNKNOWN_TEXT_VALUES = new Set(["unknown", "n/a", "na", "null", "undefined"]);

export interface PhotoInfoTabField {
  label: string;
  value: string | number | null | undefined;
}

interface PhotoInfoTabContentProps {
  title: string;
  description?: string | null;
  fields: PhotoInfoTabField[];
  emptyStateMessage?: string;
  layout?: "stacked" | "definition-list";
  className?: string;
  fieldsClassName?: string;
  fieldClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
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

export function PhotoInfoTabContent({
  title,
  description,
  fields,
  emptyStateMessage = "No metadata is available for this photo.",
  layout = "stacked",
  className,
  fieldsClassName,
  fieldClassName,
  labelClassName,
  valueClassName,
  titleClassName,
  descriptionClassName,
}: PhotoInfoTabContentProps): ReactElement {
  const visibleFields = fields.filter((field) => shouldRenderValue(field.value));

  return (
    <div className={className}>
      <h3 className={titleClassName}>{title}</h3>
      {description ? <p className={descriptionClassName}>{description}</p> : null}

      {visibleFields.length > 0 ? (
        layout === "definition-list" ? (
          <dl className={fieldsClassName}>
            {visibleFields.map((field) => (
              <div key={field.label} className={fieldClassName}>
                <dt className={labelClassName}>{field.label}</dt>
                <dd className={valueClassName}>{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className={fieldsClassName}>
            {visibleFields.map((field) => (
              <div key={field.label} className={fieldClassName}>
                <p className={labelClassName}>{field.label}</p>
                <p className={valueClassName}>{field.value}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        <p className={descriptionClassName}>{emptyStateMessage}</p>
      )}
    </div>
  );
}
