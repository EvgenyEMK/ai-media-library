// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SmartAlbumRatingFilterRow } from "./SmartAlbumRatingFilterRow";

describe("SmartAlbumRatingFilterRow", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows ≥ when operator is gte", () => {
    render(
      <SmartAlbumRatingFilterRow
        label="Rating"
        value={4}
        operator="gte"
        onOperatorChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Rating operator/i })).toHaveTextContent("≥");
  });

  it("shows = when operator is eq", () => {
    render(
      <SmartAlbumRatingFilterRow
        label="Rating"
        value={4}
        operator="eq"
        onOperatorChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Rating operator/i })).toHaveTextContent("=");
  });
});
