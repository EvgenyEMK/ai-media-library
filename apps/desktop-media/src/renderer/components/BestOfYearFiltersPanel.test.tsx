// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import type { SmartAlbumFilters } from "@emk/shared-contracts";
import { SMART_ALBUM_AI_SEARCH_QUERY_DEBOUNCE_MS } from "../lib/smart-album-search-ui";
import { BestOfYearFiltersPanel } from "./BestOfYearFiltersPanel";

const baseFilters: SmartAlbumFilters = {
  includeUnconfirmedFaces: true,
  ratingLogic: "or",
  query: "sunset",
};

function renderPanel(overrides: {
  filters?: SmartAlbumFilters;
  onClose?: () => void;
  onClear?: () => void;
  onFiltersChange?: (updater: (current: SmartAlbumFilters) => SmartAlbumFilters) => void;
} = {}): { onClose: () => void; onClear: () => void; onFiltersChange: (u: (c: SmartAlbumFilters) => SmartAlbumFilters) => void } {
  const onClose = overrides.onClose ?? vi.fn();
  const onClear = overrides.onClear ?? vi.fn();
  const onFiltersChange =
    overrides.onFiltersChange ??
    vi.fn((updater: (current: SmartAlbumFilters) => SmartAlbumFilters) => {
      void updater(overrides.filters ?? baseFilters);
    });
  render(
    <BestOfYearFiltersPanel
      filters={overrides.filters ?? baseFilters}
      personTags={[]}
      onClose={onClose}
      onClear={onClear}
      onFiltersChange={onFiltersChange}
      onTogglePersonTag={vi.fn()}
    />,
  );
  return { onClose, onClear, onFiltersChange };
}

describe("BestOfYearFiltersPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
  });

  it("calls onClose when the panel close control is used, not onClear", () => {
    const { onClose, onClear } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Close search inputs" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it("calls onClear when Clear filters is clicked", () => {
    const { onClose, onClear } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears the AI prompt via the clear control", () => {
    const onFiltersChange = vi.fn((updater: (current: SmartAlbumFilters) => SmartAlbumFilters) => {
      const next = updater(baseFilters);
      expect(next.query).toBeUndefined();
    });
    renderPanel({ onFiltersChange });
    fireEvent.click(screen.getByRole("button", { name: "Clear AI search prompt" }));
    expect(onFiltersChange).toHaveBeenCalled();
  });

  it("clears the AI prompt on Escape when the field is focused", () => {
    function Harness(): ReactElement {
      const [filters, setFilters] = useState<SmartAlbumFilters>({ ...baseFilters, query: "beach" });
      return (
        <BestOfYearFiltersPanel
          filters={filters}
          personTags={[]}
          onClose={vi.fn()}
          onClear={vi.fn()}
          onFiltersChange={(updater) => setFilters((current) => updater(current))}
          onTogglePersonTag={vi.fn()}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByPlaceholderText("AI search prompt (optional)");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("does not render the prompt clear control when the prompt is empty", () => {
    renderPanel({ filters: { includeUnconfirmedFaces: true, ratingLogic: "or" } });
    expect(screen.queryByRole("button", { name: "Clear AI search prompt" })).not.toBeInTheDocument();
  });

  it("debounces committing the AI query to the parent", () => {
    vi.useFakeTimers();
    function DebounceHarness(): ReactElement {
      const [filters, setFilters] = useState<SmartAlbumFilters>({ includeUnconfirmedFaces: true, ratingLogic: "or" });
      return (
        <>
          <BestOfYearFiltersPanel
            filters={filters}
            personTags={[]}
            onClose={vi.fn()}
            onClear={vi.fn()}
            onFiltersChange={(updater) => setFilters((current) => updater(current))}
            onTogglePersonTag={vi.fn()}
          />
          <span data-testid="committed-query">{filters.query ?? ""}</span>
        </>
      );
    }
    render(<DebounceHarness />);
    fireEvent.change(screen.getByPlaceholderText("AI search prompt (optional)"), { target: { value: "mountains" } });
    expect(screen.getByTestId("committed-query")).toHaveTextContent("");
    act(() => {
      vi.advanceTimersByTime(SMART_ALBUM_AI_SEARCH_QUERY_DEBOUNCE_MS - 1);
    });
    expect(screen.getByTestId("committed-query")).toHaveTextContent("");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("committed-query")).toHaveTextContent("mountains");
  });
});
