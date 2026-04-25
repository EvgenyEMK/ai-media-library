import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ChevronDown } from "lucide-react";
import {
  DEFAULT_THUMBNAIL_QUICK_FILTERS,
  THUMBNAIL_CATEGORY_OPTIONS,
  THUMBNAIL_DOCUMENT_OPTIONS,
  THUMBNAIL_PEOPLE_OPTIONS,
  THUMBNAIL_RATING_BAND_OPTIONS,
  countActiveQuickFilters,
  type ThumbnailCategoryQuickFilter,
  type ThumbnailDocumentsQuickFilter,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import { cn } from "../lib/cn";

const FILTER_TEXT = {
  title: "Quick filters",
  people: "People",
  userRating: "Rating",
  aiRating: "AI Rating",
  categories: "Categories",
  documents: "Documents",
  eventYears: "Event years (database)",
  locationContains: "Location contains",
  locationPlaceholder: "e.g. Paris",
  yearFrom: "From year",
  yearTo: "To year",
  multiChoice: "Mutli-choice:",
  clearAll: "Clear all filters",
} as const;

/* ── Custom <select> replacement ─────────────────────────────────── */

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  buttonDataTestId?: string;
}

function CustomSelect({ value, options, onChange, buttonDataTestId }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleDown, true);
    return () => window.removeEventListener("mousedown", handleDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative min-w-[180px]" ref={wrapRef}>
      <button
        type="button"
        data-testid={buttonDataTestId}
        className="flex w-full min-w-[180px] cursor-pointer items-center justify-between rounded-md border border-input bg-secondary px-1.5 py-1 text-left text-[13px] leading-snug text-muted-foreground shadow-none hover:border-[#4a5575]"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown size={14} aria-hidden="true" className="ml-1 shrink-0 opacity-60" />
      </button>
      {open ? (
        <ul
          className="absolute left-0 right-0 top-[calc(100%+2px)] z-[60] m-0 max-h-[220px] list-none overflow-y-auto rounded-md border border-input bg-card p-0 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
          role="listbox"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={cn(
                "cursor-pointer whitespace-nowrap px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-[#1f2740]",
                opt.value === value && "bg-[#2a2f50] text-white",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface FilterCheckboxRowProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  checkboxDataTestId?: string;
  select?: {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    buttonDataTestId?: string;
  };
}

function FilterCheckboxRow({
  label,
  checked,
  onCheckedChange,
  checkboxDataTestId,
  select,
}: FilterCheckboxRowProps) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 text-[13px] leading-snug text-muted-foreground">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          data-testid={checkboxDataTestId}
          className="h-4 w-4 min-w-0 cursor-pointer accent-indigo-500"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {select ? (
        <CustomSelect
          value={select.value}
          options={select.options}
          onChange={select.onChange}
          buttonDataTestId={select.buttonDataTestId}
        />
      ) : null}
    </div>
  );
}

/* ── Normalised option arrays ────────────────────────────────────── */

const PEOPLE_SELECT_OPTIONS: SelectOption[] = THUMBNAIL_PEOPLE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const RATING_BAND_SELECT_OPTIONS: SelectOption[] = THUMBNAIL_RATING_BAND_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const DOCUMENT_SELECT_OPTIONS: SelectOption[] = [
  { value: "all", label: "All" },
  ...THUMBNAIL_DOCUMENT_OPTIONS.map((o) => ({ value: o.key, label: o.label })),
];

const CATEGORY_SELECT_OPTIONS: SelectOption[] = THUMBNAIL_CATEGORY_OPTIONS.map((o) => ({
  value: o.key,
  label: o.label,
}));

/* ── QuickFiltersMenu ────────────────────────────────────────────── */

interface QuickFiltersMenuProps {
  isOpen: boolean;
  filters: ThumbnailQuickFilterState;
  onFiltersChange: Dispatch<SetStateAction<ThumbnailQuickFilterState>>;
  placementClassName?: string;
}

export const QuickFiltersMenu = memo(function QuickFiltersMenu({
  isOpen,
  filters,
  onFiltersChange,
  placementClassName = "absolute -right-11 top-9",
}: QuickFiltersMenuProps) {
  const activeCount = useMemo(() => countActiveQuickFilters(filters), [filters]);

  const handlePeopleChange = useCallback(
    (value: string) => {
      onFiltersChange((prev) => {
        const next = value as ThumbnailQuickFilterState["people"];
        return {
          ...prev,
          people: next,
          peopleEnabled: true,
        };
      });
    },
    [onFiltersChange],
  );

  const handlePeopleToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, peopleEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleUserRatingChange = useCallback(
    (value: string) => {
      onFiltersChange((prev) => {
        const next = value as ThumbnailQuickFilterState["userRating"];
        return {
          ...prev,
          userRating: next,
          userRatingEnabled: true,
        };
      });
    },
    [onFiltersChange],
  );

  const handleUserRatingToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, userRatingEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleAiRatingChange = useCallback(
    (value: string) => {
      onFiltersChange((prev) => {
        const next = value as ThumbnailQuickFilterState["aiRating"];
        return {
          ...prev,
          aiRating: next,
          aiRatingEnabled: true,
        };
      });
    },
    [onFiltersChange],
  );

  const handleAiRatingToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, aiRatingEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleDocumentCategoryChange = useCallback(
    (value: string) => {
      onFiltersChange((prev) => {
        const next = value as ThumbnailDocumentsQuickFilter;
        return {
          ...prev,
          documents: next,
          documentsEnabled: true,
        };
      });
    },
    [onFiltersChange],
  );

  const handleDocumentsToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, documentsEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleCategorySelectChange = useCallback(
    (value: string) => {
      onFiltersChange((prev) => {
        const next = value as ThumbnailCategoryQuickFilter;
        return {
          ...prev,
          category: next,
          categoriesEnabled: true,
        };
      });
    },
    [onFiltersChange],
  );

  const handleCategoriesToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, categoriesEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleMultiChoiceChange = useCallback(
    (value: string) => {
      onFiltersChange((prev) => ({
        ...prev,
        multiChoiceMode: value === "and" ? "and" : "or",
      }));
    },
    [onFiltersChange],
  );

  const handleDateRangeToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, dateRangeEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleLocationToggle = useCallback(
    (checked: boolean) => {
      onFiltersChange((prev) => ({ ...prev, locationEnabled: checked }));
    },
    [onFiltersChange],
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange(DEFAULT_THUMBNAIL_QUICK_FILTERS);
  }, [onFiltersChange]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="desktop-quick-filters-menu"
      className={cn(
        placementClassName,
        "z-40 grid min-w-[300px] gap-1 rounded-lg border border-border bg-card p-2",
      )}
    >
      <div className="px-1 pb-1.5 pt-1 text-[13px] font-semibold text-[#d3def6]">{FILTER_TEXT.title}</div>

      <FilterCheckboxRow
        label={FILTER_TEXT.people}
        checked={filters.peopleEnabled}
        onCheckedChange={handlePeopleToggle}
        checkboxDataTestId="quick-filter-people-checkbox"
        select={{
          value: filters.people,
          options: PEOPLE_SELECT_OPTIONS,
          onChange: handlePeopleChange,
          buttonDataTestId: "quick-filter-people-select",
        }}
      />

      <FilterCheckboxRow
        label={FILTER_TEXT.documents}
        checked={filters.documentsEnabled}
        onCheckedChange={handleDocumentsToggle}
        checkboxDataTestId="quick-filter-documents-checkbox"
        select={{
          value: filters.documents,
          options: DOCUMENT_SELECT_OPTIONS,
          onChange: handleDocumentCategoryChange,
          buttonDataTestId: "quick-filter-documents-select",
        }}
      />

      <FilterCheckboxRow
        label={FILTER_TEXT.userRating}
        checked={filters.userRatingEnabled}
        onCheckedChange={handleUserRatingToggle}
        checkboxDataTestId="quick-filter-user-rating-checkbox"
        select={{
          value: filters.userRating,
          options: RATING_BAND_SELECT_OPTIONS,
          onChange: handleUserRatingChange,
          buttonDataTestId: "quick-filter-user-rating-select",
        }}
      />

      <FilterCheckboxRow
        label={FILTER_TEXT.aiRating}
        checked={filters.aiRatingEnabled}
        onCheckedChange={handleAiRatingToggle}
        checkboxDataTestId="quick-filter-ai-rating-checkbox"
        select={{
          value: filters.aiRating,
          options: RATING_BAND_SELECT_OPTIONS,
          onChange: handleAiRatingChange,
          buttonDataTestId: "quick-filter-ai-rating-select",
        }}
      />

      <FilterCheckboxRow
        label={FILTER_TEXT.categories}
        checked={filters.categoriesEnabled}
        onCheckedChange={handleCategoriesToggle}
        checkboxDataTestId="quick-filter-categories-checkbox"
        select={{
          value: filters.category,
          options: CATEGORY_SELECT_OPTIONS,
          onChange: handleCategorySelectChange,
          buttonDataTestId: "quick-filter-categories-select",
        }}
      />

      <div className="flex flex-col gap-2 border-t border-border/60 pt-2 text-[13px] leading-snug text-muted-foreground">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-500"
            checked={filters.dateRangeEnabled}
            onChange={(e) => handleDateRangeToggle(e.target.checked)}
          />
          <span>{FILTER_TEXT.eventYears}</span>
        </label>
        {filters.dateRangeEnabled ? (
          <div className="ml-6 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1">
              <span className="text-xs">{FILTER_TEXT.yearFrom}</span>
              <input
                type="number"
                className="h-8 w-20 rounded-md border border-input bg-secondary px-1.5 text-[13px]"
                min={1800}
                max={2200}
                placeholder="—"
                value={filters.dateRangeStartYear ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onFiltersChange((prev) => ({
                    ...prev,
                    dateRangeStartYear: raw === "" ? null : Math.trunc(Number(raw)),
                  }));
                }}
              />
            </label>
            <label className="inline-flex items-center gap-1">
              <span className="text-xs">{FILTER_TEXT.yearTo}</span>
              <input
                type="number"
                className="h-8 w-20 rounded-md border border-input bg-secondary px-1.5 text-[13px]"
                min={1800}
                max={2200}
                placeholder="—"
                value={filters.dateRangeEndYear ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onFiltersChange((prev) => ({
                    ...prev,
                    dateRangeEndYear: raw === "" ? null : Math.trunc(Number(raw)),
                  }));
                }}
              />
            </label>
          </div>
        ) : null}
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-500"
            checked={filters.locationEnabled}
            onChange={(e) => handleLocationToggle(e.target.checked)}
          />
          <span>{FILTER_TEXT.locationContains}</span>
        </label>
        {filters.locationEnabled ? (
          <input
            type="search"
            className="ml-6 h-8 w-full min-w-[200px] rounded-md border border-input bg-secondary px-2 text-[13px]"
            placeholder={FILTER_TEXT.locationPlaceholder}
            value={filters.locationQuery}
            onChange={(e) =>
              onFiltersChange((prev) => ({ ...prev, locationQuery: e.target.value }))
            }
          />
        ) : null}
      </div>

      <div className="flex min-h-8 items-center justify-between gap-2 text-[13px] leading-snug text-muted-foreground">
        <span>{FILTER_TEXT.multiChoice}</span>
        <div className="inline-flex items-center gap-1.5" role="group" aria-label={FILTER_TEXT.multiChoice}>
          <button
            type="button"
            className={cn(
              "min-w-11 cursor-pointer rounded-md border border-input bg-secondary px-2 py-0.5 text-xs text-muted-foreground shadow-none",
              filters.multiChoiceMode === "or" && "border-indigo-500 bg-[#2a2f50] text-white",
            )}
            onClick={() => handleMultiChoiceChange("or")}
          >
            OR
          </button>
          <button
            type="button"
            className={cn(
              "min-w-11 cursor-pointer rounded-md border border-input bg-secondary px-2 py-0.5 text-xs text-muted-foreground shadow-none",
              filters.multiChoiceMode === "and" && "border-indigo-500 bg-[#2a2f50] text-white",
            )}
            onClick={() => handleMultiChoiceChange("and")}
          >
            AND
          </button>
        </div>
      </div>

      <div className="mt-1.5 border-t border-border pt-1.5">
        <button
          type="button"
          data-testid="quick-filter-clear-all"
          className="w-full cursor-pointer border-0 bg-transparent p-0 px-0.5 text-left font-inherit leading-snug text-inherit shadow-none"
          onClick={handleClearAll}
          disabled={activeCount === 0}
        >
          {FILTER_TEXT.clearAll}
        </button>
      </div>
    </div>
  );
});
