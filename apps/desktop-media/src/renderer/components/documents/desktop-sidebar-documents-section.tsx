import type { ReactElement } from "react";
import { cn } from "../../lib/cn";
import { UI_TEXT } from "../../lib/ui-text";

function documentsSubRowClassName(selected: boolean): string {
  return cn(
    "block w-full truncate rounded-md border text-left text-sm font-normal shadow-none outline-none hover:bg-muted",
    "py-1.5 pl-7 pr-5",
    selected
      ? "border-primary bg-primary/10 text-foreground hover:bg-primary/10"
      : "border-transparent bg-transparent text-foreground",
  );
}

export function DesktopSidebarDocumentsSection({
  isInvoicesReceiptsActive,
  onOpenInvoicesReceipts,
}: {
  isInvoicesReceiptsActive: boolean;
  onOpenInvoicesReceipts: () => void;
}): ReactElement {
  return (
    <div className="space-y-0.5 pb-1">
      <button
        type="button"
        onClick={onOpenInvoicesReceipts}
        className={documentsSubRowClassName(isInvoicesReceiptsActive)}
      >
        {UI_TEXT.documentsInvoicesReceiptsNav}
      </button>
    </div>
  );
}
