// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SmartAlbumFilters } from "@emk/shared-contracts";
import { BestOfPersonPeopleFiltersPanel } from "./BestOfPersonPeopleFiltersPanel";

const emptyFilters: SmartAlbumFilters = {};

function renderPanel(filters: SmartAlbumFilters = emptyFilters): void {
  render(
    <BestOfPersonPeopleFiltersPanel
      filters={filters}
      selectedPersonTagIds={[]}
      personTags={[]}
      resetKey={0}
      onClose={vi.fn()}
      onClear={vi.fn()}
      onFiltersChange={vi.fn()}
      onTogglePersonTag={vi.fn()}
    />,
  );
}

describe("BestOfPersonPeopleFiltersPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hides AI prompt, location, and year range by default", () => {
    renderPanel();
    expect(screen.queryByPlaceholderText("AI search prompt (optional)")).toBeNull();
    expect(screen.queryByPlaceholderText("Country, area, or city")).toBeNull();
    expect(screen.getByRole("button", { name: "More filters" })).toBeVisible();
    expect(screen.getByText("Rating")).toBeVisible();
  });

  it("shows extra fields after More filters", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.getByPlaceholderText("AI search prompt (optional)")).toBeVisible();
    expect(screen.getByPlaceholderText("Country, area, or city")).toBeVisible();
    expect(screen.getByRole("button", { name: "Less filters" })).toBeVisible();
  });

  it("expands automatically when filters include an AI query", () => {
    renderPanel({ query: "sunset" });
    expect(screen.getByDisplayValue("sunset")).toBeVisible();
  });
});
