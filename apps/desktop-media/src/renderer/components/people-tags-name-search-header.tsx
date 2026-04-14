import { type ReactElement } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./ui/input";

const UI_TEXT = {
  filterAriaLabel: "Filter people by name",
  clearFilter: "Clear name filter",
} as const;

export function PeopleTagsNameSearchField({
  value,
  onChange,
  placeholder,
  inputWrapperClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  inputWrapperClassName: string;
}): ReactElement {
  return (
    <div className={inputWrapperClassName}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 shrink-0 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value.length > 0) {
            event.preventDefault();
            onChange("");
          }
        }}
        aria-label={UI_TEXT.filterAriaLabel}
        className={`h-9 py-1.5 pl-9 text-sm md:text-sm${value.length > 0 ? " pr-9" : ""}`}
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 z-10 inline-flex size-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={UI_TEXT.clearFilter}
          title={UI_TEXT.clearFilter}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function PeopleTagsNameSearchHeader({
  columnLabel,
  value,
  onChange,
}: {
  columnLabel: string;
  value: string;
  onChange: (next: string) => void;
}): ReactElement {
  return (
    <th className="px-3 py-2 align-top">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {columnLabel}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:max-w-xs">
          <PeopleTagsNameSearchField
            value={value}
            onChange={onChange}
            inputWrapperClassName="relative flex min-h-9 min-w-0 max-w-xs flex-1 items-center"
          />
        </div>
      </div>
    </th>
  );
}

/** Compact inline filter (e.g. Tagged faces): narrow field, optional placeholder, trailing controls. */
export function PeopleTagsNameSearchRow({
  value,
  onChange,
  placeholder,
  trailingSlot,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  trailingSlot?: ReactElement | null;
}): ReactElement {
  return (
    <div className="inline-flex min-w-0 shrink-0 items-center gap-2">
      <PeopleTagsNameSearchField
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputWrapperClassName="relative flex h-9 min-w-0 w-[13.333rem] max-w-[13.333rem] shrink-0 items-center"
      />
      {trailingSlot}
    </div>
  );
}
