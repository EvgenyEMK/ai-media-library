import type { ReactElement } from "react";
import { X } from "lucide-react";
import { UI_TEXT } from "../../lib/ui-text";
import { Input } from "../ui/input";
import { InvoiceReceiptDateFilterField } from "./invoice-receipt-date-filter-field";

export function InvoiceReceiptFiltersPanel({
  issuedByDraft,
  dateFromDraft,
  dateToDraft,
  totalFromDraft,
  totalToDraft,
  currencyDraft,
  onIssuedByChange,
  onDateFromChange,
  onDateToChange,
  onTotalFromChange,
  onTotalToChange,
  onCurrencyChange,
  onClose,
}: {
  issuedByDraft: string;
  dateFromDraft: string;
  dateToDraft: string;
  totalFromDraft: string;
  totalToDraft: string;
  currencyDraft: string;
  onIssuedByChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onTotalFromChange: (value: string) => void;
  onTotalToChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onClose: () => void;
}): ReactElement {
  return (
    <section className="relative mt-3 shrink-0 border border-ai-search-border bg-ai-search-panel px-4 py-2.5 text-ai-search-text">
      <button
        type="button"
        className="absolute right-3 top-2.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control text-ai-search-text hover:bg-ai-search-control/80"
        onClick={onClose}
        aria-label={UI_TEXT.invoicesReceiptsFiltersClose}
        title={UI_TEXT.invoicesReceiptsFiltersClose}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="mt-1 flex flex-wrap items-start gap-x-4 gap-y-3 pr-10 [&_input]:border-ai-search-border [&_input:not(:placeholder-shown):not(:focus)]:border-ai-search-accent [&_input]:bg-ai-search-control [&_input]:text-ai-search-text [&_input]:placeholder:text-ai-search-muted/75 [&_input]:focus:border-ai-search-accent [&_input]:focus:ring-ai-search-accent/45">
        <label className="grid min-w-[10rem] max-w-full flex-1 gap-1">
          <span className="text-xs font-medium text-ai-search-muted">{UI_TEXT.invoicesReceiptsIssuedBy}</span>
          <Input
            value={issuedByDraft}
            onChange={(e) => onIssuedByChange(e.target.value)}
            placeholder={UI_TEXT.invoicesReceiptsIssuedBy}
            autoComplete="off"
          />
        </label>
        <label className="grid w-fit max-w-full gap-1">
          <span className="text-xs font-medium text-ai-search-muted">{UI_TEXT.invoicesReceiptsDateFrom}</span>
          <InvoiceReceiptDateFilterField
            value={dateFromDraft}
            onChange={onDateFromChange}
            className="w-[11.5rem] font-mono text-sm"
          />
        </label>
        <label className="grid w-fit max-w-full gap-1">
          <span className="text-xs font-medium text-ai-search-muted">{UI_TEXT.invoicesReceiptsDateTo}</span>
          <InvoiceReceiptDateFilterField
            value={dateToDraft}
            onChange={onDateToChange}
            className="w-[11.5rem] font-mono text-sm"
          />
        </label>
        <label className="grid w-[7rem] gap-1">
          <span className="text-xs font-medium text-ai-search-muted">{UI_TEXT.invoicesReceiptsTotalFrom}</span>
          <Input
            inputMode="decimal"
            value={totalFromDraft}
            onChange={(e) => onTotalFromChange(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="grid w-[7rem] gap-1">
          <span className="text-xs font-medium text-ai-search-muted">{UI_TEXT.invoicesReceiptsTotalTo}</span>
          <Input
            inputMode="decimal"
            value={totalToDraft}
            onChange={(e) => onTotalToChange(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="grid w-[4.5rem] gap-1">
          <span className="text-xs font-medium text-ai-search-muted">{UI_TEXT.invoicesReceiptsCurrency}</span>
          <Input
            value={currencyDraft}
            onChange={(e) => onCurrencyChange(e.target.value)}
            maxLength={3}
            spellCheck={false}
            className="font-mono uppercase"
            placeholder="EUR"
            autoComplete="off"
          />
        </label>
      </div>
    </section>
  );
}
