import type { ReactElement } from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import type { InvoiceReceiptDocumentRow } from "../../../shared/ipc";
import {
  formatInvoiceTotalDisplayParts,
  formatInvoiceVatDisplayParts,
} from "../../lib/invoice-receipt-amount-warnings";
import { isInvoiceReceiptSampleRowId } from "../../lib/invoice-receipt-mock-rows";
import { UI_TEXT } from "../../lib/ui-text";
import { toFileUrl } from "../face-cluster-utils";

const TABLE_COL_COUNT = 5;
const THUMB_BOX = "size-[84px] shrink-0 rounded object-cover";

function AmberHint({ label }: { label: string }): ReactElement {
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-400">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function renderThumbCell(row: InvoiceReceiptDocumentRow, show: boolean): ReactElement {
  if (!show) {
    return <span className="inline-block min-h-[1lh]" aria-hidden="true" />;
  }
  if (!row.sourcePath.trim() || isInvoiceReceiptSampleRowId(row.id)) {
    return (
      <div
        className={`flex ${THUMB_BOX} items-center justify-center border border-dashed border-border bg-muted/40 text-[10px] text-muted-foreground`}
      >
        Sample
      </div>
    );
  }
  const url = toFileUrl(row.sourcePath);
  if (row.mediaKind === "video") {
    return (
      <video className={THUMB_BOX} src={url} muted preload="metadata" playsInline />
    );
  }
  return <img className={THUMB_BOX} src={url} alt="" loading="lazy" decoding="async" />;
}

function headerStickyClassName(): string {
  return "sticky z-10 border-b border-border bg-card/95 py-2 font-medium backdrop-blur";
}

export function InvoiceReceiptDocumentsTable({
  rows,
  showThumbnails,
  onToggleThumbnails,
  onOpenItem,
  nothingFound,
  nothingFoundLabel,
}: {
  rows: InvoiceReceiptDocumentRow[];
  showThumbnails: boolean;
  onToggleThumbnails: (next: boolean) => void;
  onOpenItem: (mediaItemId: string, catalogSourcePath?: string | null) => void;
  nothingFound: boolean;
  nothingFoundLabel: string;
}): ReactElement {
  const stickyHeaderClass = `${headerStickyClassName()} top-0`;

  return (
    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
      <thead>
        <tr>
          {showThumbnails ? (
            <th className={`${stickyHeaderClass} pr-3`}>
              <div className="flex w-[84px] shrink-0 justify-center">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => onToggleThumbnails(false)}
                  title={UI_TEXT.invoicesReceiptsToggleThumbnailsHide}
                  aria-label={UI_TEXT.invoicesReceiptsToggleThumbnailsHide}
                >
                  <EyeOff size={28} aria-hidden="true" />
                </button>
              </div>
            </th>
          ) : (
            <th className={`${stickyHeaderClass} w-10 pr-2`}>
              <div className="flex w-full items-center justify-center">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => onToggleThumbnails(true)}
                  title={UI_TEXT.invoicesReceiptsToggleThumbnailsShow}
                  aria-label={UI_TEXT.invoicesReceiptsToggleThumbnailsShow}
                >
                  <Eye size={28} aria-hidden="true" />
                </button>
              </div>
            </th>
          )}
          <th className={`${stickyHeaderClass} pr-3`}>{UI_TEXT.invoicesReceiptsColumnIssuer}</th>
          <th className={`${stickyHeaderClass} pr-3`}>{UI_TEXT.invoicesReceiptsColumnDate}</th>
          <th className={`${stickyHeaderClass} pr-3`}>{UI_TEXT.invoicesReceiptsColumnTotal}</th>
          <th className={stickyHeaderClass}>{UI_TEXT.invoicesReceiptsColumnVat}</th>
        </tr>
      </thead>
      <tbody>
        {nothingFound ? (
          <tr>
            <td
              colSpan={TABLE_COL_COUNT}
              className="bg-background py-8 text-center text-base font-medium text-muted-foreground md:text-lg"
            >
              {nothingFoundLabel}
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const totalParts = formatInvoiceTotalDisplayParts(row.totalAmount, row.currency);
            const vatParts = formatInvoiceVatDisplayParts(
              row.totalAmount,
              row.vatPercent,
              row.vatAmount,
              row.currency,
            );

            return (
              <tr
                key={row.id}
                className={`border-b border-border/80 ${isInvoiceReceiptSampleRowId(row.id) ? "" : "cursor-pointer hover:bg-muted/50"}`}
                onClick={() => {
                  if (!isInvoiceReceiptSampleRowId(row.id)) {
                    onOpenItem(row.id, row.sourcePath);
                  }
                }}
              >
                {showThumbnails ? (
                  <td className="py-2 pr-3 align-middle">{renderThumbCell(row, true)}</td>
                ) : (
                  <td className="py-2 pr-2 align-middle">{renderThumbCell(row, false)}</td>
                )}
                <td className="max-w-[14rem] truncate py-2 pr-3 align-middle">{row.issuer ?? "—"}</td>
                <td className="py-2 pr-3 align-middle tabular-nums">{row.invoiceDate ?? "—"}</td>
                <td className="py-2 pr-3 align-middle tabular-nums">
                  <div className="flex flex-col items-start">
                    <span>{totalParts.display}</span>
                    {totalParts.decimalPlacesWarning ? (
                      <AmberHint label={UI_TEXT.invoicesReceiptsTotalDecimalSuspicious} />
                    ) : null}
                  </div>
                </td>
                <td className="py-2 align-middle tabular-nums">
                  <div className="flex flex-col items-start">
                    <span>{vatParts.line}</span>
                    {vatParts.percentMismatch ? (
                      <AmberHint label={UI_TEXT.invoicesReceiptsVatConsistencyWrong} />
                    ) : null}
                    {vatParts.decimalWarningOnAmount ? (
                      <AmberHint label={UI_TEXT.invoicesReceiptsVatDecimalSuspicious} />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
