import { type ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { peoplePaginationTotalPages } from "../lib/people-pagination-total-pages";

export { peoplePaginationTotalPages };

export function PeoplePaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  disabled,
  ariaLabel,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}): ReactElement | null {
  const totalPages = peoplePaginationTotalPages(totalItems, pageSize);
  if (totalPages <= 1 && totalItems <= pageSize) {
    return null;
  }

  const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const start = totalItems === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(totalItems, (safePage + 1) * pageSize);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
      role="navigation"
      aria-label={ariaLabel ?? "Pagination"}
    >
      <span className="text-muted-foreground">
        {totalItems === 0 ? "No items" : `${start}–${end} of ${totalItems}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || safePage <= 0}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="tabular-nums text-muted-foreground">
          Page {safePage + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={disabled || safePage >= totalPages - 1}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
