// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SmartAlbumYearAreaSubviewBar } from "./smart-album-year-area-subview-bar";

describe("SmartAlbumYearAreaSubviewBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onSubViewChange when the inactive option is clicked", () => {
    const onSubViewChange = vi.fn();
    render(<SmartAlbumYearAreaSubviewBar subView="year-city" onSubViewChange={onSubViewChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Country > YYYY-MM Area" }));

    expect(onSubViewChange).toHaveBeenCalledWith("month-area");
  });

  it("does not emit when the active option is clicked again", () => {
    const onSubViewChange = vi.fn();
    render(<SmartAlbumYearAreaSubviewBar subView="month-area" onSubViewChange={onSubViewChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Country > YYYY-MM Area" }));

    expect(onSubViewChange).not.toHaveBeenCalled();
  });
});
