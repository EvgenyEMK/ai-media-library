import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import { sanitizeInvoiceIsoDateDraft } from "../../lib/invoice-receipt-date-draft";
import { Input } from "../ui/input";

export function InvoiceReceiptDateFilterField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}): ReactElement {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="YYYY-MM-DD"
      maxLength={10}
      value={value}
      className={className}
      onChange={(e: ChangeEvent<HTMLInputElement>): void => {
        onChange(sanitizeInvoiceIsoDateDraft(e.target.value));
      }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === "Delete") {
          e.preventDefault();
          onChange("");
        }
      }}
    />
  );
}
