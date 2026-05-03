// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { SummaryCardStatusStack } from "./SummaryCardStatusStack";

describe("SummaryCardStatusStack", () => {
  afterEach(cleanup);

  it("shows spinner when loading", () => {
    const { container } = render(
      <SummaryCardStatusStack loading topRow={<Check data-testid="glyph" size={16} aria-hidden />} />,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByTestId("glyph")).toBeNull();
  });

  it("renders top and bottom rows when not loading", () => {
    render(
      <SummaryCardStatusStack
        loading={false}
        topRow={
          <>
            <Check data-testid="glyph" size={16} aria-hidden />
            <span>42%</span>
          </>
        }
        bottomRow="12 / 14 folders"
      />,
    );
    expect(screen.getByTestId("glyph")).toBeVisible();
    expect(screen.getByText("42%")).toBeVisible();
    expect(screen.getByText("12 / 14 folders")).toBeVisible();
  });
});
