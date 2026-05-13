import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { HelpCircle, Loader2, Search } from "lucide-react";
import {
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  type InvoiceReceiptDocumentsListRequest,
  type InvoiceReceiptDocumentRow,
} from "../../../shared/ipc";
import { createDocumentActions } from "../../actions/document-actions";
import { ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS } from "../../lib/album-list-search-ui";
import { INVOICE_RECEIPT_SAMPLE_ROWS } from "../../lib/invoice-receipt-mock-rows";
import { UI_TEXT } from "../../lib/ui-text";
import { ToolbarIconButton } from "../ToolbarIconButton";
import { PeoplePaginationBar } from "../people-pagination-bar";
import { ALBUM_ITEMS_PAGE_SIZE } from "../DesktopAlbumDetailPanel";
import { countActiveInvoiceFilters } from "../../lib/invoice-receipt-filter-count";
import { useDesktopStore } from "../../stores/desktop-store";
import { InvoiceReceiptDocumentsTable } from "./invoice-receipt-documents-table";
import { InvoiceReceiptFiltersPanel } from "./invoice-receipt-filters-panel";
import { InvoicesReceiptsHelpModal } from "./invoices-receipts-help-modal";

export function DesktopInvoicesReceiptsWorkspace({
  onOpenItem,
}: {
  onOpenItem: (mediaItemId: string, catalogSourcePath?: string | null) => void;
}): ReactElement {
  const actions = useMemo(
    () => createDocumentActions(window.desktopApi),
    [],
  );

  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [listTotal, setListTotal] = useState(0);
  const [rows, setRows] = useState<InvoiceReceiptDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchControlsOpen, setSearchControlsOpen] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);

  const [issuedByDraft, setIssuedByDraft] = useState("");
  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");
  const [totalFromDraft, setTotalFromDraft] = useState("");
  const [totalToDraft, setTotalToDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("");

  const [appliedFilters, setAppliedFilters] = useState<InvoiceReceiptDocumentsListRequest>({});

  const [helpOpen, setHelpOpen] = useState(false);

  const photoAnalysisModel = useDesktopStore((s) => s.photoAnalysisSettings.model);
  const aiSelectedModel = useDesktopStore((s) => s.aiSelectedModel);
  const effectivePhotoAnalysisModel = useMemo(
    () => (photoAnalysisModel ?? aiSelectedModel).trim() || DEFAULT_PHOTO_ANALYSIS_SETTINGS.model,
    [aiSelectedModel, photoAnalysisModel],
  );

  const sampleMode = catalogCount === 0;
  const activeFilterCount = useMemo(() => countActiveInvoiceFilters(appliedFilters), [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void actions.loadInvoiceReceiptCatalogCount().then(
      (count) => {
        if (cancelled) return;
        setCatalogCount(count);
        setSearchControlsOpen(count > 0);
        setPage(0);
        setAppliedFilters({});
        setIssuedByDraft("");
        setDateFromDraft("");
        setDateToDraft("");
        setTotalFromDraft("");
        setTotalToDraft("");
        setCurrencyDraft("");
        if (count === 0) {
          setRows([...INVOICE_RECEIPT_SAMPLE_ROWS]);
          setListTotal(INVOICE_RECEIPT_SAMPLE_ROWS.length);
          setLoading(false);
        }
      },
      () => {
        if (cancelled) return;
        setErrorMessage(UI_TEXT.invoicesReceiptsLoadCountError);
        setCatalogCount(0);
        setRows([...INVOICE_RECEIPT_SAMPLE_ROWS]);
        setListTotal(INVOICE_RECEIPT_SAMPLE_ROWS.length);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [actions]);

  useEffect(() => {
    if (sampleMode || catalogCount == null || catalogCount === 0) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    const req: InvoiceReceiptDocumentsListRequest = {
      ...appliedFilters,
      page,
      pageSize: ALBUM_ITEMS_PAGE_SIZE,
    };
    void actions.loadInvoiceReceiptDocuments(req).then(
      (result) => {
        if (cancelled) return;
        setListTotal(result.total);
        setRows(result.rows);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setErrorMessage(UI_TEXT.invoicesReceiptsLoadRowsError);
        setRows([]);
        setListTotal(0);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [actions, appliedFilters, catalogCount, page, sampleMode]);

  useEffect(() => {
    if (catalogCount == null || sampleMode) {
      return;
    }
    setPage(0);
  }, [appliedFilters, catalogCount, sampleMode]);

  useEffect(() => {
    if (catalogCount == null || sampleMode) {
      return;
    }
    const handle = window.setTimeout(() => {
      const next: InvoiceReceiptDocumentsListRequest = {
        issuedBy: issuedByDraft.trim() || undefined,
        dateFrom: dateFromDraft.trim() || undefined,
        dateTo: dateToDraft.trim() || undefined,
        totalFrom: totalFromDraft.trim() === "" ? undefined : Number(totalFromDraft),
        totalTo: totalToDraft.trim() === "" ? undefined : Number(totalToDraft),
        currency: currencyDraft.trim().toUpperCase() || undefined,
      };
      if (Number.isNaN(next.totalFrom as number)) delete next.totalFrom;
      if (Number.isNaN(next.totalTo as number)) delete next.totalTo;
      setAppliedFilters((prev) => {
        const same =
          (prev.issuedBy ?? "") === (next.issuedBy ?? "") &&
          (prev.dateFrom ?? "") === (next.dateFrom ?? "") &&
          (prev.dateTo ?? "") === (next.dateTo ?? "") &&
          (prev.totalFrom ?? null) === (next.totalFrom ?? null) &&
          (prev.totalTo ?? null) === (next.totalTo ?? null) &&
          (prev.currency ?? "") === (next.currency ?? "");
        if (same) {
          return prev;
        }
        return next;
      });
    }, ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [
    catalogCount,
    currencyDraft,
    dateFromDraft,
    dateToDraft,
    issuedByDraft,
    sampleMode,
    totalFromDraft,
    totalToDraft,
  ]);

  const showNothingFound =
    !sampleMode && !loading && catalogCount != null && catalogCount > 0 && listTotal === 0;

  const applyCurrencyInput = useCallback((raw: string): void => {
    setCurrencyDraft(raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3));
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-card/90 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2">
            <h1 className="text-xl font-semibold">{UI_TEXT.documentsInvoicesReceiptsNav}</h1>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex size-[33px] shrink-0 items-center justify-center rounded-full border border-border p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={UI_TEXT.invoicesReceiptsHelpAria}
              title={UI_TEXT.invoicesReceiptsHelpAria}
            >
              <HelpCircle className="size-[29px]" aria-hidden="true" />
            </button>
          </div>
          {!sampleMode ? (
            <ToolbarIconButton
              title={searchControlsOpen ? UI_TEXT.invoicesReceiptsFiltersClose : UI_TEXT.invoicesReceiptsFiltersOpen}
              ariaExpanded={searchControlsOpen}
              ariaPressed={activeFilterCount > 0}
              isActive={searchControlsOpen || activeFilterCount > 0}
              badgeCount={activeFilterCount}
              onClick={() => setSearchControlsOpen(!searchControlsOpen)}
            >
              <Search size={16} aria-hidden="true" />
            </ToolbarIconButton>
          ) : null}
        </div>
        {!sampleMode && searchControlsOpen ? (
          <InvoiceReceiptFiltersPanel
            issuedByDraft={issuedByDraft}
            dateFromDraft={dateFromDraft}
            dateToDraft={dateToDraft}
            totalFromDraft={totalFromDraft}
            totalToDraft={totalToDraft}
            currencyDraft={currencyDraft}
            onIssuedByChange={setIssuedByDraft}
            onDateFromChange={setDateFromDraft}
            onDateToChange={setDateToDraft}
            onTotalFromChange={setTotalFromDraft}
            onTotalToChange={setTotalToDraft}
            onCurrencyChange={applyCurrencyInput}
            onClose={() => setSearchControlsOpen(false)}
          />
        ) : null}
      </div>

      {sampleMode ? (
        <div
          className="mx-4 mt-3 rounded-md border border-amber-600/50 bg-amber-500/15 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          {UI_TEXT.invoicesReceiptsSampleBanner}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-0">
        {loading && !sampleMode ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : (
          <InvoiceReceiptDocumentsTable
            rows={rows}
            showThumbnails={showThumbnails}
            onToggleThumbnails={setShowThumbnails}
            onOpenItem={onOpenItem}
            nothingFound={showNothingFound}
            nothingFoundLabel={UI_TEXT.invoicesReceiptsNothingFound}
          />
        )}
      </div>

      {!sampleMode ? (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <PeoplePaginationBar
            ariaLabel="Invoices and receipts pagination"
            currentPage={page}
            totalItems={listTotal}
            pageSize={ALBUM_ITEMS_PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      <InvoicesReceiptsHelpModal
        open={helpOpen}
        effectivePhotoAnalysisModel={effectivePhotoAnalysisModel}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
